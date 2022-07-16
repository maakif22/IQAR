const
    db = require('../models/db'),
    hl = require('handy-log'),
    P = require('bluebird'),
    fs = require('fs'),
    path = require('path'),
    crypto = require('crypto'),
    dir = process.cwd(),
    jwt = require('jsonwebtoken'),
    passport = require('passport'),
    os = require('os');

const signup = (req, res) => {

    let { body: { firstname, lastname, email, phone, password, password_again, age, push_id, isadmin }, session } = req

    req.checkBody('firstname', 'First Name is empty').notEmpty()
    req.checkBody('email', 'Email is empty').notEmpty()
    req.checkBody('email', 'Email is invalid').isEmail()
    req.checkBody('phone', 'Phone is empty').notEmpty()
    req.checkBody('password', 'Password field is empty').notEmpty()
    req.checkBody('password_again', 'Password again field is empty').notEmpty()
    req.checkBody('password', 'Passwords don\'t match').equals(password_again)

    let errors = req.validationErrors()
    if (errors) {
        let array = []
        for (let item of errors) {
            array.push(item.msg)
        }
        res.json({ mssg: array })
    } else {
        db.query('SELECT COUNT(*) as userCount from users WHERE email = ?', [email])
            .then(email => {
                if (email[0].userCount == 1) {
                    res.json({ mssg: "Email already exists!", error: "Email already exists!" })
                } else {
                    let newUser = {
                        unqid: crypto.randomBytes(3).toString('hex'),
                        firstname,
                        lastname,
                        email: req.body.email,
                        gender: req.body.gender,
                        password,
                        email_verified: "yes",
                    }
                    if (isadmin) {
                        newUser.isadmin = 1
                    }
                    let newUserDetail = {
                        phone: req.body.phone,
                        res_address: req.body.res_address,
                        profile_pic: '',
                        state: req.body.state,
                        user_age: req.body.age,
                        country: req.body.country,
                        user_id: ''
                    }
                    if (push_id) {
                        newUserDetail.push_id = push_id
                    }
                    return db.createUser(newUser, newUserDetail)
                }
            })
            .then(async user => {
                let superadmin = await db.query("Select id from users where isSuperAdmin = ? ", [1])
                let relationship = {
                    user_one_id: user.insertId,
                    user_two_id: superadmin[0].id,
                    status: 1,
                    action_user_id: superadmin[0].id
                }
                db.query('INSERT INTO relationship SET ?', relationship, (err, res) => {
                    err ? reject(err) : resolve(res)
                })

                let { affectedRows, insertId } = user

            })
            .catch(err => console.log(hl.error(err)))
    }
}
const getUserId = (unqid) => {
    return db.query('SELECT id from users WHERE unqid = ? LIMIT 1', [unqid])
        .then(row => {
            var user = JSON.parse(JSON.stringify(row[0]));
            return user;
        })
}
//Forgot Password
const forgot = (req, res) => {
    console.log("inside forgot function")
    P.coroutine(function* () {
        let { body: { email: email }, session } = req
        req.checkBody('email', 'Email is empty').notEmpty()

        let errors = req.validationErrors()
        if (errors) {
            let array = []
            for (let item of errors) {
                array.push(item.msg)
            }
            res.json({ mssg: array, success: false })
        } else {
            db.query('SELECT COUNT(*) as userCount from users WHERE email = ?', [email])
                .then(row => {
                    console.log("query executed")
                    if (row[0].userCount == 1) {
                        db.updateToken(email, req, res)
                          .then(function (result) {
                                console.log(result);
                                res.json({ mssg: "Email! sent successfully!!", success: true })
                            }).catch(err => console.log(err))
                        console.log('This after update1');
                    } else {
                        res.status(400).json({ mssg: "No account with that email address exists.", success: false })
                    }
                })
        }
    })()
}

//Reset Password
const reset = (req, res) => {
    P.coroutine(function* () {
        let token = req.params.token;
        db.query('SELECT resetPasswordExpires, email From users WHERE resetPasswordToken = "' + token + '"')
            .then(result => {
                row = JSON.parse(JSON.stringify(result));
                var email = row[0].email;
                var resetPasswordExpires = row[0].resetPasswordExpires;

                if (row.length == 1) {

                    let twoHoursBefore = resetPasswordExpires + (2 * 60 * 60 * 1000);

                    if (twoHoursBefore > Date.now()) {
                        res.render('user/updatepassword', { email });
                    }
                    else {
                        res.redirect('/forgot-password');
                    }

                } else {
                    console.log('token not exists');
                }
            })
    })()
}


const contact = (req, res) => {
    P.coroutine(function* () {
        let { body: { email, subject, message }, session } = req
        req.checkBody('email', 'Email is empty').notEmpty()
        req.checkBody('email', 'Email is invalid').isEmail()
        req.checkBody('message', 'Message field is empty').notEmpty()
        req.checkBody('message', 'max Char allowed only 10').isLength({ max: 100 })

        let errors = req.validationErrors()
        if (errors) {
            let array = []
            for (let item of errors) {
                array.push(item.msg)
            }
            res.json({ mssg: array })
        } else {

            let options = {
                to: process.env.MAIL_ADMIN,
                from: email,
                subject: subject,
            }

            let renderable = {
                template: path.join("emails", "users", "contactus.html"),
                locals: {
                    message: message,
                    email: email,
                    subject: subject,
                }
            }

            mail(options, renderable)
                .then(m => {
                    console.log(m)
                    res.json({ mssg: "email! sent successfully!!", success: true })
                })
                .catch(me => {
                    hl.error(me)
                    res.json({ mssg: "Error sending email!" })
                })
        }
    })()
}

const getUserdetails = (id) => {
    return db.query('SELECT profile_pic, state, country from user_details WHERE user_id = ? LIMIT 1', [id])
        .then(row => {
            var profile = JSON.parse(JSON.stringify(row[0]));
            return profile;
        })
}

const setLogedinUser = (session, user) => {
    session.id = user.id
    session.usertype = user.isadmin
    session.isSuperAdmin = user.isSuperAdmin
    session.gender = user.gender
    session.email = user.email
    session.firstname = user.firstname
    session.email_verified = user.email_verified
    getUserdetails(session.id).then(function (result) {
        session.pic = result.profile_pic;
        session.state = result.state;
        session.country = result.country;

        if (session.pic == null || session.pic == '') {
            session.pic = session.gender + '.jpg';
        }
    });
    return session;
}

const login = (req, res) => {
    P.coroutine(function* () {
        let { body: { email: email, password: rpassword, push_id }, session } = req

        //console.log('push_id'+push_id);
        if (!req.body.exist) {
            req.checkBody('email', 'Email is empty').notEmpty()
            req.checkBody('password', 'Password field is empty').notEmpty()
        }

        let errors = req.validationErrors()
        if (errors) {
            let array = []
            for (let item of errors) {
                array.push(item.msg)
            }
            res.json({ mssg: array })
        } else {

            let user = yield db.query('SELECT COUNT(id) as userCount,firstname,email, id, password,status,flag, email_verified, isadmin,isSuperAdmin,gender from users WHERE email = ? GROUP BY id LIMIT 1', [email])

            if (user.length) {
                if (user[0].status == 0 && user[0].flag != 1) {
                    res.json({ error: "User inactive. Please contact administrator!", mssg: "User inactive. Please contact administrator!" })
                    return
                }
                if (user[0].flag == 1) {
                    res.json({ error: "Account suspended!", mssg: "Account suspended!" })
                    return
                }
                let [{ userCount, id, password, firstname, email_verified, isadmin, gender }] = user
                var same
                if (!req.body.exist) {
                    same = yield db.comparePassword(rpassword, password)
                } else {
                    same = 1
                }

                if (!same) {
                    res.json({ error: "Wrong Credentials!", mssg: "Wrong Credentials!" })
                } else {
                    var setedUser = setLogedinUser(session, user[0]);

                    let insert = {
                        user_id: req.session.id,
                        device_id: os.hostname(),
                        device_type: os.type(),
                        token: crypto.randomBytes(64).toString('hex')
                    }
                    db.AddDevice(insert);
                    let push_user_id
                    if (req.session.id) {
                        push_user_id = req.session.id
                    } else {
                        push_user_id = user[0].id
                    }
                    //console.log('push_user_id:'+push_user_id);
                    //console.log('push_id(login):'+push_id);

                    db.updatePushId(req.session.id, push_id)
                    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;

                    if (ip.substr(0, 7) == "::ffff:") {
                        ip = ip.substr(7)
                    }

                    let last_activity = {
                        user_id: user[0].id,
                        ip: ip,
                        status: '1'
                    }

                    db.updateActivity('y', req.session.id);
                    db.addActivity(last_activity)
                    if (setedUser.id) {
                        if (req.originalUrl.indexOf("api") != -1) {
                            var token = jwt.sign({ user: id }, process.env.SECRET_KEY);
                            res.json({ mssg: `Hello, ${setedUser.firstname}!!`, success: true, usertype: setedUser.usertype, id: setedUser.id, token: token, user_id: setedUser.id })
                        } else {
                            res.json({ mssg: `Hello, ${setedUser.firstname}!!`, success: true, usertype: setedUser.usertype, id: setedUser.id, user_id: setedUser.id })
                        }

                    } else {
                        res.json({ error: 'something wrong', mssg: 'something wrong' });
                    }
                }
            } else {
                res.json({ error: "Wrong Credentials!", mssg: "Wrong Credentials!" })
            }
        }
    })()
}

passport.serializeUser(function (user, cb) {
    cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
    console.log('obj:' + obj)
    cb(null, obj);
});

const registered = (req, res) => {
    P.coroutine(function* () {
        let
            title = "You are now registered!",
            { id } = req.session,
            reg = yield db.query("SELECT email_verified FROM users WHERE id=? LIMIT 1", [id]),
            [{ email_verified }] = reg,
            options = Object.assign({}, { title }, { layout: false }, { mssg: "Email has been sent. Check your inbox and click on the provided link!!" })

        email_verified == "yes" ?
            res.redirect(`/deep/most/topmost/activate/${id}`)
            :
            res.render("registered", options)

    })()
}

const activate = (req, res) => {
    P.coroutine(function* () {
        let
            { params: { id }, session } = req,
            title = "E-mail activation!!",
            act = yield db.query('UPDATE users SET email_verified=? WHERE id=?', ["yes", id]),
            { changedRows } = act

        mssg = (changedRows == 0) ? "Email already verified!" : "You email has been verified successfully!"
        session.email_verified = "yes"
        let options = Object.assign({}, { title }, { mssg })
        res.render("activate", { options })
    })()
}

/**
*For login with facebook
*/
const facebookSignup = (req, res) => {
    let { session } = req

    db.query('SELECT id,email from users WHERE fb_id = ?', [req.user.id])
        .then(rows => {
            if (rows.length > 0) {
                user = rows[0];
                session.id = user.id
                session.email = user.email
                session.email_verified = "yes"
            } else {
                let newUser = {
                    firstname: req.user.firstname,
                    lastname: req.user.lastname,
                    fb_id: req.user.id,
                    email: req.user.email,
                    email_verified: "yes",
                    joined: new Date().getTime()
                }
                db.query('INSERT INTO users SET ?', newUser)
                    .then(user => {
                        let { affectedRows, insertId } = user
                        if (affectedRows == 1) {
                            fs.mkdir(dir + `/public/users/${insertId}`, (err) => {
                                if (err) {
                                    console.log(err)
                                } else {
                                    fs
                                        .createReadStream(dir + '/public/images/spacecraft.jpg')
                                        .pipe(fs.createWriteStream(dir + `/public/users/${insertId}/user.jpg`))
                                }
                            })
                            session.id = insertId
                            session.firstname = req.user.displayName
                            session.email_verified = "yes"
                        }
                    })
            }
        })
        .catch(err => console.log(hl.error(err)))
}

const setsession = (req, res) => {
    req.session.id = 12
    req.session.email = 'anonymous'
    req.session.email_verified = "yes"
}

module.exports = {
    signup,
    login,
    registered,
    activate,
    facebookSignup,
    setsession,
    contact,
    forgot,
    setLogedinUser,
    reset,
    getUserId
}
