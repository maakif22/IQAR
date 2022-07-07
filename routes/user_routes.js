const
    app = require('express').Router(),
    db = require('../models/db'),
    hl = require('handy-log'),
    mw = require('../models/middlewares'),
    mail = require('../models/mail'),
    login = require('../models/_login'),
    configAuth = require('../models/auth'),
    P = require('bluebird'),
    passport = require('passport'),
    path = require("path"),
    FacebookStrategy = require('passport-facebook').Strategy,
    Window = require('window'),
    url = require("url")
    , fs = require("fs")
    , root = process.cwd();

// success page 
app.get('/success', (req, res) => {
    if (req.query.hasOwnProperty('cancelled')) {
        res.redirect(`/err?cancelled=true`)
        return
    }
    P.coroutine(function* () {

        db.query("SELECT count(id) as count from `payment_history` where payment_id= ? and payment_status != ?", [req.query.paymentId, 'completed'])
            .then(row => {
                if (row[0].count) {
                    db.query("UPDATE `payment_history` SET `payment_token` = ? , `payer_id` = ?, `payment_status` = ?,payment_method = ? WHERE `payment_id` = ?", [req.query.token, req.query.PayerID, 'completed', "paypal", req.query.paymentId])
                        .then(_ => {
                            let sql = 'SELECT ud.credit_balance,u.email,u.firstname, ud.user_id, ph.payment_amount,ph.product FROM `user_details` ud  left join payment_history ph on ud.user_id = ph.user_id inner join users u where u.id=ud.user_id and ph.payment_id ="' + req.query.paymentId + '"';
                            return db.query(sql)
                        })
                        .then(async rows => {
                            let email = rows[0].email
                            let username = rows[0].firstname
                            let amount = rows[0].payment_amount
                            let product = rows[0].product
                            let options = {
                                to: email,
                                subject: 'Your purchase is confirmed!'
                            }

                            let renderable = {
                                template: path.join("emails", "users", "tokenSuccessful.html"),
                                locals: {
                                    amount: product,
                                    username: username,
                                }
                            }

                            mail(options, renderable).then(_ => {
                                console.log("Mail sent")
                            }).catch(err => {
                                console.log(err)
                            })
                            let credit_balance = rows[0].credit_balance
                            let new_credit_balance = credit_balance + Number(req.query.product);
                            let user_id = rows[0].user_id;
                            if (!req.session) {
                                let user = await db.query('SELECT COUNT(id) as userCount,firstname,email, id, password,status,flag, email_verified, isadmin, gender from users WHERE id = ? GROUP BY id LIMIT 1', [user_id])
                                login.setLogedinUser(req.session, user[0])
                            }
                            db.query('UPDATE `user_details` SET `credit_balance` = ? WHERE user_id= ?', [new_credit_balance, user_id])
                        })
                } else {
                    console.log("Invalid")
                }
            }).catch(err => {
                console.log(err)
            })

    })()
    res.render('user/success');
});
app.post('/success', (req, res) => {
    if (req.query.hasOwnProperty('cancelled')) {
        res.redirect(`/err?cancelled=true`)
        return
    }
    let response = JSON.parse(req.body.resp).tx
    db.query('INSERT INTO payment_history SET `user_id`=?,`payment_id`= ?, `payment_amount`=?, `payment_token` = ? , `payer_id` = ?, `payment_status` = ?,`payment_method` = ?,currency_type=?,product=?', [req.query.id, req.query.txref, response.amount, req.query.flwref, response.customerId, 'initialised', 'rave', req.query.currency, req.query.product])
        .then(_ => {
            let sql = 'SELECT ud.credit_balance,u.email,u.firstname, ud.user_id, ph.payment_amount,ph.payment_status FROM `user_details` ud inner join users u on u.id = ud.user_id left join payment_history ph on ud.user_id = ph.user_id  where ph.payment_id ="' + req.query.txref + '"';
            return db.query(sql)
        })
        .then(async rows => {
            if (rows[0].payment_status != 'completed') {
                await db.query('UPDATE `payment_history` SET `payment_status` = ? WHERE payment_id= ?', ["completed", req.query.txref])
                let credit_balance = rows[0].credit_balance
                let new_credit_balance = credit_balance + Number(req.query.product);
                let user_id = rows[0].user_id;
                let username = rows[0].firstname
                let email = rows[0].email

                let insert = {
                    user_id: user_id,
                    payment_id: req.query.txref,
                    payment_amount: response.amount,
                    product: req.query.product,
                }

                db.transactionLog(req, res, { ...insert, 'currency': req.query.currency })

                let options = {
                    to: email,
                    subject: 'Your purchase is confirmed!'
                }

                let renderable = {
                    template: path.join("emails", "users", "tokenSuccessful.html"),
                    locals: {
                        amount: req.query.product,
                        username: username,
                    }
                }
                mail(options, renderable).then(_ => {
                    console.log("Mail sent")
                }).catch(err => {
                    console.log(err)
                })

                if (!req.session) {
                    let user = await db.query('SELECT COUNT(id) as userCount,firstname,email, id, password,status,flag, email_verified, isadmin, gender from users WHERE id = ? GROUP BY id LIMIT 1', [user_id])
                    login.setLogedinUser(req.session, user[0])
                }

                db.query('UPDATE `user_details` SET `credit_balance` = ? WHERE user_id= ?', [new_credit_balance, user_id])
            } else {
                db.query('DELETE FROM payment_history where payment_id=? and payment_status=?', [req.query.txref, 'initialised'])
                console.error("Payment already done")
            }
        }).catch(err => console.log(err))
    res.render('user/success');
});

// Reset password 
app.get('/reset/:token', mw.NotLoggedIn, (req, res) => {
    login.reset(req, res);
})

// Update password 
app.get('/update-password', mw.NotLoggedIn, (req, res) => {
    res.render('front/updatepassword');
})


// error page 
app.get('/err', mw.LoggedIn, (req, res) => {
    let context = {}
    context.message = 'Transaction was cancelled'
    res.render('user/err', context)
})

// Purchase token page 


app.get('/signup', mw.NotLoggedIn, (req, res) => {
    let options = { title: "Signup to note" }

    if (req.query) {
        options.email = req.query.email
        options.gender = req.query.gender
        options.first_name = req.query.first_name
        options.last_name = req.query.last_name
    }

    res.render('user/register', { options, layout: false })
})
//Forgot Password

app.get('/forgot-password', mw.NotLoggedIn, function (req, res) {
    res.render('user/forgotpassword');
});

//Registered user activation.
app.get('/registered', mw.LoggedIn, (req, res) => {
    login.registered(req, res)
})

app.get('/deep/most/topmost/activate/:id', mw.LoggedIn, (req, res) => {
    login.activate(req, res)
})

//Settings
app.get('/changepassword', mw.LoggedIn, (req, res) => {
    res.render('user/changepassword', { id: req.session.id });
})

app.get('/settings/id-verification', mw.LoggedIn, (req, res) => {
    res.render('user/verification', { id: req.session.id });
})

//settings end
app.get('/contact-us', (req, res) => {
    let options = { title: "Contact Us" }
    res.render('pages/customercare', { options })
})

app.get('/login', mw.NotLoggedIn, (req, res, next) => {
    let options = { title: "Login" }
    res.render('user/login', { options, layout: false })
})

// Passport-facebook Strategy


//Login with Facebook

//User signup                                      
app.post('/user/signup', (req, res) => {
    login.signup(req, res)
})

app.post('/user/login', (req, res) => {
    login.login(req, res)
})
app.post('/user/contact-us', (req, res) => {
    login.contact(req, res)
})

app.get('/myprofile/:id', mw.LoggedIn, mw.MeOrNot, mw.view_profile, async (req, res) => {
    let profile, friends, requests;
    friends = db.query('SELECT b.id,b.firstname, b.email, a.status FROM `relationship` as a JOIN users as b on (a.user_one_id=b.id and a.user_one_id!=' + req.session.id + ') or (a.user_two_id=b.id and a.user_two_id!=' + req.session.id + ') WHERE (a.`user_one_id` = ' + req.session.id + ' OR a.`user_two_id` = ' + req.session.id + ') AND a.`status` = 1')
    requests = db.query('SELECT a.*,b.firstname,b.email FROM `relationship` as a join users as b on b.id=a.user_one_id where a.user_two_id=' + req.session.id + ' and a.status=0');
    profile = db.query('Select users.*, user_details.* from users JOIN user_details on (users.id=user_details.user_id) where users.id = ' + req.params.id + ' limit 1 ');

    [friends, requests, profile] = await Promise.all([friends, requests, profile])
    profile = profile[0]
    res.render('user/myprofile', { profile: profile, rows: requests, friends: friends, id: req.params.id, userId: req.session.id })
})

app.get('/profile/:id', mw.LoggedIn, mw.MeOrNot, mw.view_profile, async (req, res) => {
    let profile, friends;
    profile = db.query('SELECT users.*, user_details.profile_pic, relationship.user_one_id, relationship.user_two_id, relationship.status,user_details.res_address,user_details.state,user_details.country FROM `users` left join relationship on ( (user_one_id=users.id and user_two_id=' + req.session.id + ') or (user_two_id=users.id and user_one_id=' + req.session.id + ') ) left join user_details on users.id = user_details.user_id where users.id =' + req.params.id + ' ');
    friends = db.query('SELECT b.id,b.firstname,b.email, a.status FROM `relationship` as a JOIN users as b on (a.user_one_id=b.id and a.user_one_id!=' + req.params.id + ') or (a.user_two_id=b.id and a.user_two_id!=' + req.params.id + ') WHERE (a.`user_one_id` = ' + req.params.id + ' OR a.`user_two_id` = ' + req.params.id + ') AND a.`status` = 1');
    [profile, friends] = await Promise.all([profile, friends])
    profile = profile[0]
    res.render('user/profile', { profile: profile, friends: friends, id: req.params.id, userId: req.params.id })
})

app.get('/logout', mw.LoggedIn, (req, res) => {
    let last_activity = {
        user_id: req.session.id,
        ip: req.connection.remoteAddress,
        status: '0'
    }
    let activity = {
        online: 'n',
        id: req.session.id
    }
    db.updateActivity('n', req.session.id);
    db.addActivity(last_activity)

    req.session.id = null
    if (req.session.id == null) {
        res.redirect('/login')
    }
})

app.get('/editmyprofile', mw.LoggedIn, async (req, res) => {
    let profile, userinfo;
    profile = db.query('SELECT * from users where id = ?', req.session.id)
    userinfo = db.query('SELECT * FROM user_details WHERE user_id= ?', req.session.id)
    let [prof, user] = await Promise.all([profile, userinfo])
    res.render('user/editmyprofile', { profile: prof[0], userinfo: user[0] });
})

app.get('/editbankdetails', mw.LoggedIn, (req, res) => {
    let userinfo;
    console.log('req.session.id',req.session.id)
    db.query('SELECT * FROM user_details WHERE user_id= ?', req.session.id)
        .then(rows => {
            userinfo = rows[0]
            res.render('user/accountinfo', { userinfo: userinfo });
        })
})

app.post('/updateActivity', async (req, res) => {
    let user = req.body.session
    await db.updateActivity('y', user)
})

app.get("/users/gamestats/:id", async function (req, res) {
    let user = req.params.id
    await db.getPlayerStats(res, user)
})

app.get("/notification", function (req, res) {
    let user = req.session.id
    db.getNotificationList(res, user)
})

app.post("/registerNotification", function (req, res) {
    let data = req.body
    data.user_id = req.session.id
    db.setNotificationStatus(res, data)
})

app.post("/makefavourite", async (req, res) => {
    let { body: { game_id }, session } = req
    if (session.id) {
        try {
            let fav = await db.query(`SELECT COUNT(id) AS alreadyExist FROM favorite_games where user_id = ? and game_id = ?`, [session.id, game_id])
            if (fav[0].alreadyExist) {
                await db.query("DELETE FROM favorite_games WHERE user_id = ? and game_id= ?", [session.id, game_id])
                res.json({ mssg: "Removed from favourite", success: 'removed' })
                return
            }
            let construct = { user_id: session.id, game_id: game_id }
            await db.query(`INSERT INTO favorite_games SET ? ON DUPLICATE KEY UPDATE game_id = ?`, [construct, game_id])
            res.json({ mssg: "Added to favourites", success: true })
        } catch (err) {
            console.log(err)
        }
    } else {
        res.json({ mssg: "You need to be logged in" })
    }
})

app.get("/thankyou", (req, res) => {
    res.render("user/thankyou")
})
module.exports = app
