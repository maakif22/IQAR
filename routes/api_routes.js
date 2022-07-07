const
    app = require('express').Router(),
    root = process.cwd(),
    db = require('../models/db'),
    _login = require('../models/_login'),
    mail = require('../models/mail'),
    // upload = require('multer')({ dest: `${root}/public/temp/` }),
    multer = require('multer'),
    //upload = multer({dest: `${root}/public/`}),
    P = require('bluebird'),
    pi = require('handy-image-processor'),
    bcrypt = require('bcrypt-nodejs'),
    Jimp = require("jimp"),
    mw = require('../models/middlewares'),
    path = require('path'),
    fs = require('fs');

app.post('/login', (req, res) => {

    if (req.session.id) {
        res.json({ id: req.session.id, email: req.session.email, firstname: req.session.firstname })
        return;
    }
    _login.login(req, res);
})

app.post('/signup', (req, res) => {
    if (req.session.id) {
        res.json({ id: req.session.id, email: req.session.email, firstname: req.session.firstname })
        return;
    }
    _login.signup(req, res);
})

app.post('/forgot', function (req, res, next) {

    if (req.session.id) {
        res.json({ id: req.session.id, email: req.session.email, firstname: req.session.firstname })
        return;
    }
    _login.forgot(req, res)
});

/* Sale Token*/

app.get('/logout', (req, res) => {

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (ip.substr(0, 7) == "::ffff:") {
        ip = ip.substr(7)
    }

    if (req.session.id) {

        let last_activity = {
            user_id: req.session.id,
            ip: ip,
            status: '0'
        }
        db.updateActivity({ online: 'n', id: req.session.id });
        db.addActivity(last_activity)

        req.session.id = null
        return res.status(200).json({ 'success': true, mssg: 'user logout successfully' });

    } else {
        return res.status(400).json({ 'error': true, mssg: 'Bad Request' });
    }

});


// /FOR DETAILS OF GIVEN USER
app.post('/get_details', (req, res) => {
    db.query('SELECT * FROM users WHERE id=?', [req.body.get])
        .then(get => res.json(get[0]))
        .catch(err => res.json(err))
})

app.post('/savemage', (req, res) => {

    P.coroutine(function* () {

        let insert = {
            user_id: req.session.id,
        }
        let srcFile = `${root}/public/temp/` + req.body.image_name,
            w = parseInt(req.body.w1),
            h = parseInt(req.body.h1),
            x = parseInt(req.body.x1),
            y = parseInt(req.body.y1),
            destFile = `${root}/public/users/${req.session.id}/` + req.body.image_name
        let storableDirectory = `${root}/public/users/${req.session.id}`

        !fs.existsSync(storableDirectory) && fs.mkdirSync(storableDirectory);

        Jimp.read(srcFile, function (err, image) {
            if (err) console.log(err);
            image.crop(x, y, w, h)            // resize
                .quality(100)                 // set JPEG quality
                .write(destFile); // save
        });

        rslt = yield db.query('UPDATE user_details SET profile_pic=? WHERE user_id=?', [req.body.image_name, req.session.id])

        if (rslt) {
            fs.unlink(srcFile, function (error) {
                if (error) {
                    throw error;
                }
                console.log('temp image!!');
            });
        }
        res.json({ mssg: "Avatar Changed", success: "true", image: `/users/${req.session.id}/${req.body.image_name}` })

    })()
})

app.post("/setProfileImage", (req, res) => {
    let { body: { avatar }, session } = req
    let destination = `${root}/public/users/${session.id}`
    let source = `${root}/public/images/avatars/${avatar}.png`
    let existence = fs.existsSync(destination)
    let image_name = `avatar_${avatar}.png`
    if (!existence) {
        fs.mkdirSync(destination)
    }
    fs.copyFile(source, `${destination}/${image_name}`, async (err) => {
        if (err) console.log(err)
        try {
            db.query(`UPDATE user_details SET profile_pic = '${image_name}' where user_id= ${session.id} `)
        } catch (err) {
            console.log(err)
        }
    })
    return res.json({ mssg: "Avatar Changed", success: "true", image: `/users/${req.session.id}/${image_name}` })
})

app.post('/change_avatar', (req, res) => {
    var storage = multer.diskStorage({
        destination: function (req, file, callback) {
            callback(null, `${root}/public/temp/`)
        },
        filename: function (req, file, callback) {
            callback(null, Date.now() + file.originalname)
        }
    })

    var upload = multer({
        storage: storage
    }).single('profile-pic')
    upload(req, res, function (err) {
        if (err) {
            console.log(err);
        }
        let filepath = `/temp/` + req.file.filename;
        res.end("<img id='photo' file-name='" + req.file.filename + "' class='preview' src='" + filepath + "' />")
    })

})

var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        try {
            var dir = `${root}/public/users/` + req.session.id + '/doc/';
            !fs.existsSync(dir) && fs.mkdirSync(dir);

            callback(null, dir)
        } catch (err) {
            console.log(err)
        }

    },

    filename: function (req, file, callback) {
        callback(null, 'vdoc' + path.extname(file.originalname))
    }
})

app.post('/upload_doc', (req, res) => {

    var upload = multer({
        storage: storage, fileFilter: function (req, file, cb) {

            if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {

                return res.json({ mssg: 'File extension is not correct.', success: false });
            }
            cb(null, true)

        }
    }).single('add_doc');

    upload(req, res, function (err) {
        if (err) {
            console.log(err);
            return res.status(500).send({ status: 500, mssg: 'internal error' });
        }

        P.coroutine(function* () {
            let acceptRequest = yield db.query('UPDATE `user_details` SET `vdoc` = ? WHERE `user_id` = ?', [req.file.filename, req.session.id])
        })()
        return res.json({ mssg: 'File uploaded successfully.', success: true });
    })

})

// FOR RESENDING VERIFICATION LINK
app.post('/resend_vl', (req, res) => {
    P.coroutine(function* () {
        let
            { id } = req.session
        e_q = yield db.query("SELECT email FROM users WHERE id=?", [id]),
            [{ email }] = e_q,
            url = `http://localhost:${process.env.PORT}/deep/most/topmost/activate/${id}`,
            options = {
                to: email,
                subject: "Activate your Notes App account",
                html: `<span>Hello, You received this message because you created an account on Notes App.<span><br><span>Click on button below to activate your account and explore.</span><br><br><a href='${url}' style='border: 1px solid #1b9be9; font-weight: 600; color: #fff; border-radius: 3px; cursor: pointer; outline: none; background: #1b9be9; padding: 4px 15px; display: inline-block; text-decoration: none;'>Activate</a>`
            }
        mail(options).then(re => res.json({ mssg: "Verification link sent to your email!" }))
    })()
})


// TO CHECK USER'S FRIENDSHIP STATUS
app.post('/status', (req, res) => {
    db.query('SELECT staus FROM follow_system WHERE follow_by=? AND follow_to=? LIMIT 1', [req.session.id, req.body.user])
        .then(status => res.json(status[0].status))
        .catch(err => res.json(err))
})

// FOR sending message
app.post('/sendMessage', (req, res) => {
    if (!req.session.id) {
        res.json({ mssg: 'you are not logedin' });
        return;
    }

    let { session, body } = req
    let insert = {
        from_id: session.id,
        thread_id: Date.now(),
        to_id: body.to_id,
        subject: body.subject,
        message: body.message,
        created_on: new Date().toISOString().slice(0, 19).replace('T', ' ')
    }

    db.query('INSERT INTO inbox SET ?', insert)
        .then(data => {
            (data.affectedRows == 1) ? res.json(Object.assign({}, insert, { message_id: data.insertId, mssg: 'Message Sent!' })) : null
        })
        .catch(err => { console.log(err); res.json(err) })
})

app.get('/friends1', function (req, res) {
    db.query('SELECT id, email, firstname from users where firstname like "%' + req.query.friend_name + '%" and id !=' + req.session.id, function (err, rows, fields) {
        if (err) throw err;

        res.end(JSON.stringify(rows));
    });
});/**/

app.get('/usr', function (req, res) {
    db.query('SELECT id, email, firstname from users where firstname like "%' + req.query.friend_name + '%" and id !=' + req.session.id, function (err, rows, fields) {
        if (err) throw err;

        res.end(JSON.stringify(rows));
    });
});/**/


//Update Password

app.post('/updatepassword', function (req, res) {

    let { body: { email: email, confirmPassword: confirmPassword, password: password }, session } = req

    db.updatePassword(email, password)
        .then(function (result) {
            if (result.affectedRows == 1) {
                res.json({ mssg: 'Your password has been changed successfully', success: true })
            } else {
                res.json({ mssg: 'There is something wrong', success: false })
            }
        });
});

//Change Password

app.post('/changepassword', function (req, res) {

    if (!req.session.id) {
        res.status(400).json({ error: true, mssg: 'Something is wrong' });
        return;
    }

    db.query('Select password from `users` WHERE `id` = ? ', [req.session.id])
        .then(rows => {
            bcrypt.compare(req.body.oldPass, rows[0].password, (err, resIn) => {
                if (resIn == true) {

                    bcrypt.hash(req.body.password, null, null, (error, hash) => {
                        req.body.password = hash

                        db.query('UPDATE `users` SET `password` = ?  WHERE `id` = ? ', [req.body.password, req.session.id])
                            .then(update => res.json({ update, success: true, uid: req.session.id }))
                            .catch(err => res.json(err))
                    })

                } else {
                    res.json({ mssg: "Old password is incorrect.", success: false })
                }
            })
        })
        .catch(err => res.json(err))
});

/**
*User details for editing profile/
*/
app.get('/myprofile/:id', (req, res) => {

    let profile;

    if (!req.session.id) {
        res.status(400).json({ error: true, mssg: 'Bad request' });
        return;
    }

    db.query('Select users.*, user_details.* from users JOIN user_details on (users.id=user_details.user_id) where users.id = ' + req.params.id + ' limit 1 ')
        .then(rows => {
            profile = rows[0];
        })
        .then(() => {
            res.status(200).json({ profile: profile })
        });

})

/**
*For edit profile info
*/
app.post('/editmyprofile', function (req, res) {
    if (!req.session.id) {
        res.status(400).json({ error: true, mssg: 'Something is wrong' });
        return;
    }

    db.query('SELECT firstname, email from users where (email = "' + req.body.email + '" ) and id = ' + req.session.id + ' ')
        .then(rows => {
            if (rows.length > 0) {
                let data = rows[0];
                return db.query('UPDATE `users` SET firstname = ?, lastname = ? WHERE `id` = ? ', [req.body.firstname, req.body.lastname, req.session.id])
                    .then(update => {
                        db.query('UPDATE `user_details` SET phone = ?, res_address = ?, user_age = ?, state = ?, country = ? WHERE `user_id` = ? ', [req.body.phone, req.body.res_address, req.body.age, req.body.state, req.body.country, req.session.id])
                        req.session.firstname = req.body.firstname
                    })
                // }
            }
        })
        .then(update => {
            res.json({ update, success: true })
        })
        .catch(err => res.json(err))
});

/**
*For edit bank info
*/
app.post('/editbankdetails', function (req, res) {
    /* db.query('UPDATE `user_details` SET bank_name = ?, bank_acc_no = ?, bank_acc_name = ?, bank_code = ? WHERE `user_id` = ? ',
      [req.body.bank_name, req.body.bank_acc_no, req.body.bank_acc_name, req.body.bank_code, req.session.id ])
             .then(update => res.json({update, success:true}))
             .catch(err => res.json(err) )*/

    let bankname = req.body.bank_name,
        bankaccno = req.body.bank_acc_no,
        bankaccname = req.body.bank_acc_name,
        bankcode = req.body.bank_code,
        user_id = req.session.id;

    P.coroutine(function* () {
        db.query('UPDATE `user_details` SET `bank_name` = ? , `bank_acc_no` = ?, `bank_acc_name` = ?, `bank_code` = ?, `verification_status` = ? WHERE `user_id` = ?', [bankname, bankaccno, bankaccname, bankcode, 1, user_id])
            .then(update => res.json({ update, success: true }))
            .catch(err => res.json(err))
    })()


});


app.post('/updateActivity', async (req, res) => {
    let user = req.body.user
    await db.updateActivity('y', user)
})

app.post("/getStatistics", async function (req, res) {
    let { option, offset } = req.body
    let sql
    try {
        if (!option) {
            sql = "SELECT u.firstname,g.game_name,ps.total_battles,ps.battles_won,ps.battles_lost,ps.coins_won,ps.coins_lost,ps.updated_at as last_played FROM `player_statistics` ps INNER JOIN users u on ps.user_id=u.id INNER JOIN games g on g.id=ps.game_id ORDER BY last_played DESC LIMIT 10 OFFSET " + offset
        }
        if (option == "wager") {
            sql = "SELECT u.firstname,SUM(ps.coins_won) as wagers_won from player_statistics ps INNER JOIN users u on u.id = ps.user_id GROUP BY firstname order by wagers_won DESC  LIMIT 10 OFFSET " + offset
        }
        if (option == "gamesplayed") {
            sql = "SELECT u.firstname,SUM(ps.total_battles) as total_battles FROM users u inner join player_statistics ps on u.id = ps.user_id group by u.firstname order by total_battles DESC  LIMIT 10 OFFSET " + offset
        }
        if (option == "oldest") {
            sql = "SELECT firstname, joined FROM users order by id asc  LIMIT 10 OFFSET " + offset
        }
        if (option == "wins") {
            sql = "SELECT u.firstname,SUM(ps.battles_won) as battles_won from player_statistics ps INNER JOIN users u on u.id = ps.user_id GROUP BY firstname order by battles_won DESC  LIMIT 10 OFFSET " + offset
        }
        if (option == "exchange") {
            sql = "SELECT u.firstname,SUM(ph.payment_amount) as exchanges from users u inner join payment_history ph on u.id=ph.user_id  GROUP BY firstname ORDER BY exchanges DESC  LIMIT 10 OFFSET " + offset
        }
        if (option == 'tokensheld') {
            sql = "SELECT u.firstname,SUM(ud.credit_balance) as tokens_held from users u inner join user_details ud on u.id = ud.user_id GROUP BY firstname ORDER BY tokens_held DESC LIMIT 10 OFFSET " + offset
        }
        if (option == 'gamesbytoken') {
            sql = "SELECT g.game_name,SUM(ps.coins_won) as tokens_won FROM games g INNER JOIN player_statistics ps on g.id = ps.game_id GROUP BY game_name ORDER BY tokens_won DESC  LIMIT 10 OFFSET " + offset
        }
        if (option == 'gamesbygames') {
            sql = "SELECT g.game_name,SUM(ps.total_battles) as total_battles FROM games g INNER JOIN player_statistics ps on g.id = ps.game_id GROUP BY game_name ORDER BY total_battles DESC  LIMIT 10 OFFSET " + offset
        }
        let result = await db.query(sql)
        res.json({ result: result, offset: 0 })
    } catch (err) {
        res.end("Error")
    }

})

app.post("/flagmessage", mw.LoggedIn, (req, res) => {
    let { id } = req.body
    try {
        db.query(`UPDATE inbox SET flagged=1 where id= ? `, [id])
        res.json({ status: true })
    } catch (err) {
        res.json({ status: false })
        console.log(err)
    }

})

app.get('/success', (req, res) => {
    db.query('INSERT INTO payment_history SET `user_id`=?,`payment_id`= ?, `payment_amount`=?, `payment_token` = ? , `payer_id` = ?, `payment_status` = ?,`payment_method` = ?,currency_type=?,product=?', [req.query.id, req.query.flwref, req.query.amount, req.query.txref, '', 'initialised', 'rave', req.query.currency, req.query.product])
        .then(rows => {
            let sql = 'SELECT ud.credit_balance, ud.user_id, ph.payment_amount,ph.payment_status FROM `user_details` ud left join payment_history ph on ud.user_id = ph.user_id  where ph.payment_token ="' + req.query.txref + '"';
            return db.query(sql)
        })
        .then(async rows => {
            if (rows && rows[0].payment_status != 'completed') {
                await db.query('UPDATE `payment_history` SET `payment_status` = ? WHERE payment_token= ?', ["completed", req.query.txref])
                var credit_balance = rows[0].credit_balance
                var new_credit_balance = credit_balance + Number(req.query.product);
                var user_id = rows[0].user_id;

                let insert = {
                    user_id: user_id,
                    payment_id: req.query.txref,
                    payment_amount: req.query.amount,
                    product: req.query.product,
                }

                db.transactionLog(req, res, { ...insert, 'currency': req.query.currency })

                if (!req.session) {
                    let user = await db.query('SELECT COUNT(id) as userCount,firstname,email, id, password,status,flag, email_verified, isadmin, gender from users WHERE id = ? GROUP BY id LIMIT 1', [user_id])
                    login.setLogedinUser(req.session, user[0])
                }

                db.query('UPDATE `user_details` SET `credit_balance` = ? WHERE user_id= ?', [new_credit_balance, user_id])
            } else {
                db.query('DELETE FROM payment_history where payment_token=? and payment_status=?', [req.query.txref, 'initialised'])
                console.error("Payment already done")
            }
            res.render('user/success');
        }).catch(err => {
            console.log("err", err)
            res.redirect('/err');
            return
        })
});
module.exports = app