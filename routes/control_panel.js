const
    app = require('express').Router(),
    db = require('../models/db'),
    mw = require('../models/middlewares'),
    usr = require('../models/admin/user'),
    page = require('../models/admin/page'),
    login = require('../models/_login'),
    P = require('bluebird'),
    mail = require('../models/mail'),
    path = require("path"),
    root = process.cwd(),
    multer = require('multer'),
    request = require("request");

app.get('/login', mw.NotLoggedIn, (req, res) => {
    res.render('admin/adminlogin', { title: "Control Panel111" });
})

//Report sections
app.get('/dashboard', mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    let totalUsers, purchasehistory
        , redeem, totalToken, total24Token
        , userByCountry, playerByGamescount
        , oldestPlayer, playersByWin, topGames
        , byTokenExchanged, byTokenHeld;
    req.query.panel = 'dashboard'
    totalUsers = db.query('SELECT COUNT(*) userCount,(select COUNT(*) from users where online="y") as online_users FROM users')
    currentMonthUsers = db.query('SELECT COUNT(*) newUsers FROM users WHERE MONTH(joined)=MONTH(CURRENT_DATE()) AND YEAR(joined)=YEAR(CURRENT_DATE())');
    last24login = db.query("SELECT COUNT(*) as last24login from last_activity WHERE status = '1' AND online_date > (NOW() - INTERVAL 24 HOUR)");
    totalToken = db.query("SELECT COUNT(*) as totalToken from payment_history")
    total24Token = db.query("SELECT COUNT(*) as total24Token from payment_history WHERE created_at > (NOW() - INTERVAL 24 HOUR)")
    userByCountry = db.query("SELECT ud.country,COUNT(*) as userCounts from users u inner join user_details ud on u.id = ud.user_id group by ud.country ORDER by userCounts DESC Limit 15")
    playerByGamescount = db.query("SELECT u.firstname as label ,SUM(ps.total_battles) as y FROM users u inner join player_statistics ps on u.id = ps.user_id group by u.firstname order by y DESC limit 5")
    oldestPlayer = db.query("SELECT firstname as label, joined as y FROM users order by id asc limit 5")
    playersByWin = db.query("SELECT u.firstname as label,SUM(ps.battles_won) as y FROM users u inner join player_statistics ps ON u.id=ps.user_id GROUP BY firstname ORDER BY y DESC LIMIT 5")
    byTokenExchanged = db.query("SELECT u.firstname as label,SUM(ph.payment_amount) as y from users u inner join payment_history ph on u.id=ph.user_id  GROUP BY firstname ORDER BY y DESC LIMIT 5")
    topGames = db.query('SELECT g.game_name as label,SUM(ps.battles_won) as y FROM games g inner join player_statistics ps ON g.id=ps.game_id GROUP BY label ORDER BY y DESC')
    byTokenHeld = db.query("SELECT u.firstname as label, u.email as eml, SUM(ud.credit_balance) as y from users u inner join user_details ud on u.id = ud.user_id GROUP BY email, firstname ORDER BY y DESC LIMIT 6")
    try {
        [totalUsers, currentMonthUsers, last24login, purchasehistory, redeem, totalToken, total24Token, userByCountry, playerByGamescount, oldestPlayer, playersByWin, byTokenExchanged, byTokenHeld, topGames] = await Promise
            .all([totalUsers, currentMonthUsers, last24login, purchasehistory, redeem, totalToken, total24Token, userByCountry, playerByGamescount, oldestPlayer, playersByWin, byTokenExchanged, byTokenHeld, topGames])
    } catch (err) {
        console.log(err)
    }

    let userByCountryConstruct = []
    let sendable = {
        redeemed: redeem,
        purchasehistory: purchasehistory,
        last24login: last24login[0].last24login,
        totalUsers: totalUsers[0].userCount,
        onlineUsers: totalUsers[0].online_users,
        currentMonthUsers: currentMonthUsers[0].newUsers,
        totalToken: totalToken[0].totalToken,
        total24Token: total24Token[0].total24Token,
        userByCountry: userByCountryConstruct,
        playerByGamescount: playerByGamescount,
        oldestPlayer: oldestPlayer,
        playersByWin: playersByWin,
        byTokenExchanged: byTokenExchanged,
        byTokenHeld: byTokenHeld,
        topGames: topGames
    }
    res.render('admin/dashboard', sendable)
});

app.get('/report/puchase-history', mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    if (await getPermission('payment_history', req)) {
        let limit = '';
        let rows = await db.query(await db.purchaseHistory(limit))
        let revenue = 0
        rows.forEach((purch => {
            revenue += purch.revenue
        }))
        var years = await db.query(`select distinct(DATE_FORMAT(created_at,'%Y')) as years from payment_history`)
        res.render('admin/purchasehistory', { phistory: rows, revenue: revenue, years: years })
    } else {
        return unauthorized(res, req)
    }
})

app.get('/report/redeem-request', mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    if (await getPermission('redeem_request', req)) {
        let limit = '';
        P.coroutine(function* () {
            let rows = yield db.query(db.redeemRequest(limit, req))

            res.render('admin/redeem', { redeemed: rows })
        })()
    } else {
        return unauthorized(res, req)
    }
})


app.get('/users', mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    if (await getPermission('users', req)) {
        usr.userlist(req, res);
    } else {
        unauthorized(res, req)
    }
})

app.get('/bannedusers', mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    if (await getPermission('banned_users', req)) {
        usr.userlist(req, res)
    } else {
        return unauthorized(res, req)
    }
})

app.get('/suspendedusers', mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    if (await getPermission('suspended_user', req)) {
        usr.userlist(req, res)
    } else {
        return unauthorized(res, req)
    }
})

app.get('/users/vdoc', mw.LoggedIn, mw.IsAdmin, (req, res) => {
    usr.userDoc(req, res);
})

app.get('/pages', mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    if (await getPermission('static_pages', req)) {
        page.pageList(req, res);
    } else {
        return unauthorized(res, req)
    }
})

app.get('/pages/edit/(:id)', mw.LoggedIn, mw.IsAdmin, (req, res) => {
    page.singlePage(req, res, req.params.id);
})

app.get('/success', mw.NotLoggedIn, (req, res) => {
    let options = { title: "Control Panel", layout: false }
    res.render('admin/success', options)
})

app.get('/profile/:id', mw.LoggedIn, mw.MeOrNot, mw.view_profile, (req, res) => {
    P.coroutine(function* () {
        let username = yield db.query('SELECT username FROM users WHERE id=?', [req.params.id])
        let options = { title: `@${username[0].username} • Notes App`, getid: req.params.id, layout: false }
        res.render('admin/profile', options)
    })()
})

app.get('/logout', mw.LoggedIn, (req, res) => {

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
    }
    if (req.session.id == null) {
        res.redirect('/login')
    }
});

//admin section

app.get('/', function (req, res, next) {
    req.getConnection(function (err, connection) {
        var query = connection.query('SELECT * FROM customer', function (err, rows) {
            if (err)
                var errornya = ("Error Selecting : %s ", err);
            req.flash('msg_error', errornya);
            res.render('customer/list', { title: "Customers", data: rows });
        });
    });
});

app.post('/users/delete', function (req, res, next) {
    let status = 'delete'
    if (req.body.ids) {
        let ids = req.body.ids
        ids.forEach((id) => {
            db.updateUserStatus(status, id);
            res.end()
        })
    } else {
        let id = req.body.id;
        db.updateUserStatus(status, id);
        req.flash('success', 'User deleted Successfully!!');
        res.redirect('/controlpanel/users');
    }
});


app.post("/users/terminate", mw.LoggedIn, mw.IsAdmin, (req, res) => {
    if (req.body.ids) {
        let ids = req.body.ids
        ids.forEach((id) => {
            db.terminateUsers(id);
            res.end()
        })
    } else {
        let id = req.body.id;
        db.terminateUsers(id);
        req.flash('success', 'User terminated Successfully!!');
        res.redirect('/controlpanel/bannedusers');
    }
})

app.post('/users/approve', function (req, res, next) {

    let id = req.body.id, table = '';
    if (req.body.ids) {
        let ids = req.body.ids
        ids.forEach((id, index) => {
            let status = req.body.status[index] == 1 ? 0 : 1;
            db.updateUserStatus(status, id);
            res.end()
        })
    } else {
        let status = req.body.status == 1 ? 0 : 1;
        db.updateUserStatus(status, id);
        req.flash('success', 'Status has changed Successfully!!');
        res.redirect('/controlpanel/users');
    }
});

app.post('/users/verification/approve', function (req, res, next) {

    let status = req.body.status == 1 ? 0 : 1;
    let id = req.body.id, table = '';

    P.coroutine(function* () {
        db.updateVerificationStatus(status, id)
            .then(async function (result) {
                let email = await db.query("Select email from users where id = ?", [id])
                email = email[0].email
                let options = {
                    to: email,
                    subject: "Document Verification Status",
                }

                let renderable = {
                    template: path.join("emails", "users", "verification.html"),
                }
                mail(options, renderable)
                    .then(console.log("Redeem mail sent"))

                req.flash('success', 'Approved Successfully!!');
                res.redirect('/controlpanel/users/vdoc');
            })
    })()

});

app.post('/report/redeem/approve', function (req, res, next) {

    let status = req.body.status == 1 ? '0' : '1';
    let id = req.body.id;
    let user_id = req.body.user_id
    P.coroutine(function* () {
        let act = yield db.query('UPDATE redeem_history SET status= ? WHERE id= ?', [status, id])
            .then(async rows => {
                let email = await db.query("Select email from users where id = ?", [user_id])
                email = email[0].email
                let mailable = await db.query(`SELECT r.*,ud.bank_name,ud.bank_acc_no,ud.bank_acc_name,u.firstname from redeem_history r join user_details ud on r.user_id = ud.user_id inner join users u on u.id=ud.user_id where r.id= ${id}`)
                let options = {
                    to: email,
                    subject: "Notification of successful OneUp token sale",
                }

                let renderable = {
                    template: path.join("emails", "users", "verification.html"),
                    locals: {
                        token: mailable[0].redeem_amount,
                        amount: mailable[0].redeem_amount * 100,
                        username: mailable[0].firstname,
                        bankname: mailable[0].bank_name,
                        acc_no: mailable[0].bank_acc_no,
                        account: mailable[0].bank_acc_name
                    }
                }
                mail(options, renderable)
                    .then(console.log("Redeem mail sent"))

                req.flash('success', 'Approved Successfully!!');
                res.redirect('/controlpanel/report/redeem-request');
            })
    })()

});

app.get('/users/edit/(:id)', function (req, res, next) {
    P.coroutine(function* () {
        db.query('Select users.*, user_details.* from users JOIN user_details on (users.id=user_details.user_id) where users.id = ' + req.params.id + ' limit 1 ')
            .then(rows => {
                profile = rows[0];
                res.render('admin/useredit', { user: profile });
            })
    })()
});

app.post('/users/update', async function (req, res, next) {
    let user_id = req.body.id;
    let errors = req.validationErrors();
    if (!errors) {
        v_firstname = req.sanitize('firstname').escape();
        v_lastname = req.sanitize('lastname').escape();
        v_email = req.sanitize('email').escape();
        v_phone = req.sanitize('phone').escape();
        v_address = req.sanitize('address').escape();

        let user = {
            firstname: v_firstname,
            lastname: v_lastname,
        }

        let user_details = {
            phone: v_phone,
            res_address: v_address
        }
        act = db.query('UPDATE users SET ? WHERE ?', [user, user_id]);
        act2 = db.query('UPDATE user_details SET ? WHERE ?', [user_details, user_id]);
        await Promise.all([act, act2])
        res.redirect('/controlpanel/users');
    }
});

app.post('/users/add', function (req, res) {
    login.signup(req, res);
});

app.post('/pagesave', function (req, res) {
    page.savePage(req, res);
});



app.get('/users/add', function (req, res, next) {
    res.render('admin/add');
});

app.get('/notification', async function (req, res, next) {
    if (await getPermission('notifications', req)) {
        res.render('admin/notification')
    } else {
        return unauthorized(res, req)
    }
})

app.get('/notification-app', async function (req, res, next) {
    if (await getPermission('notifications', req)) {
        res.render('admin/notification-app')
    } else {
        return unauthorized(res, req)
    }
})

app.get("/changepassword", function (req, res) {
    res.render('admin/changePassword', { id: req.session.id })
})
//admin section end;
app.get("/gamestatistic", mw.LoggedIn, mw.IsAdmin, async function (req, res) {
    if (await getPermission('game_statistics', req)) {
        let sql = await db.query("SELECT u.firstname,g.game_name,ps.total_battles,ps.battles_won,ps.battles_lost,ps.coins_won,ps.coins_lost,ps.updated_at as last_played FROM `player_statistics` ps INNER JOIN users u on ps.user_id=u.id INNER JOIN games g on g.id=ps.game_id ORDER BY last_played DESC limit 10")
        res.render('admin/gamestatistics', { games: sql })
    } else {
        return unauthorized(res, req)
    }
})

app.get('/message/allusermessages', mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    if (await getPermission('all_user_messages', req)) {
        db.allUserInbox(req, res, 'admin/alluserinbox');
    } else {
        return unauthorized(res, req)
    }
})

app.get('/readUserMessage/:id', mw.LoggedIn, (req, res) => {
    db.readMessage(req, res, 'admin/readUserMessage')
})

app.get("/createtournament", async (req, res) => {
    if (await getPermission('create_tournaments', req)) {
        res.render("admin/createtournament")
    } else {
        return unauthorized(res, req)
    }
})

var upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, callback) {
            callback(null, `${root}/public/images/`)
        },
        filename: function (req, file, callback) {
            callback(null, Date.now() + "tournament" + file.originalname)
        }
    })
}).single('image')

app.post("/createtournament", async (req, res) => {
    if (await getPermission('create_tournaments', req)) {
        upload(req, res, function (err) {
            if (err) {
                console.log(err);
            }
            //check if tournament doesn't fall between previously deployed tournaments
            db.query("SELECT COUNT(id) as count FROM tournament where (DATE('" + req.body.start_date + "') BETWEEN `start_date` and `end_date`) or (DATE('" + req.body.end_date + "') BETWEEN `start_date` and `end_date`)").then(row => {
                if (!row[0].count) {
                    db.query("INSERT INTO tournament SET ?", {
                        name: req.body.name,
                        start_date: req.body.start_date,
                        end_date: req.body.end_date,
                        image: req.file.filename
                    }).then(_ => {
                        req.flash('success', 'Tournament successfully  created');
                        res.redirect("/controlpanel/createtournament")
                    })
                } else {
                    req.flash('msg_error', 'Another tournament is active on the selected date');
                    res.redirect("/controlpanel/createtournament")
                }
            })
        })
    } else {
        return unauthorized(res, req)
    }
})

app.get("/viewtournament", mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    if (await getPermission('view_tournaments', req)) {
        db.query('Select * from tournament order by id DESC', (err, rows, fields) => {
            if (err) console.log(err)
            res.render("admin/tournaments", { rows: rows })
        })
    } else {
        return unauthorized(res, req)
    }
})

app.get("/updatepermissions/:id", mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    if (await getPermission('manage_permissions', req)) {
        let { params: { id } } = req
        let permissions = await db.query(`SELECT permissions from permissions where user_id=?`, [id])
        permissions = permissions[0] ? permissions[0].permissions.trim().split(" ") : ''
        res.render("admin/updatepermissions", { user: id, permissions: permissions })
    } else {
        unauthorized(res, req)
    }
})

app.post("/updatepermissions", mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    if (await getPermission('manage_permissions', req)) {
        let { body: { tags, user_id } } = req
        try {
            db.query(`INSERT INTO permissions(permissions,user_id) values( ?, ?) ON DUPLICATE KEY UPDATE permissions = ?`, [tags, user_id, tags])
            res.json({ success: true, tags: tags })
        } catch (err) {
            res.json({ success: false })
        }
    } else {
        unauthorized(res, req)
    }
})

app.post("/removePermission", mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    if (await getPermission('manage_permissions', req)) {
        let { user, tag } = req.body
        tag = tag.replace(new RegExp(",", 'g'), " ")
        try {
            db.query(`UPDATE permissions SET permissions = ? where user_id= ? `, [tag, user])
            res.json({ success: true, tags: tag })
        } catch (err) {
            console.log(err)
            res.json({ success: false })
        }
    } else {
        unauthorized(res, req)
    }
})

app.get("/managepermissions", mw.LoggedIn, mw.IsAdmin, async (req, res) => {
    if (await getPermission('manage_permissions', req) || req.session.isSuperAdmin) {
        try {
            let users = await db.query(`SELECT u.id,u.firstname, p.permissions from permissions p right join users u on p.user_id = u.id WHERE u.isadmin=1 and u.isSuperAdmin = 0 order by p.permissions desc`)
            res.render("admin/managepermissions", { users: users })
        } catch (err) {
            console.log(err)
        }
    } else {
        unauthorized(res, req)
    }
})

app.post("/getRevenue", async (req, res) => {
    let { from, to } = req.body
    let sql
    let ngn = await new Promise((resolve, reject) => {
        request.get(`http://apilayer.net/api/live?access_key=${process.env.CONVERT_CURENCY_KEY}&source = GBP&currencies=USD,NGN&format=1`, (error, response, body) => {
            let ngn = JSON.parse(body).quotes.USDNGN
            resolve(ngn)
        })
    })
    if (from && to) {
        sql = `Select SUM(ceil(IF(currency_type="USD",payment_amount*${ngn} - product*100,payment_amount - product*100))) as revenue FROM payment_history where payment_status="completed" and created_at BETWEEN DATE("${from}") and DATE("${to}")`
    } else if (from || to) {
        sql = `Select SUM(ceil(IF(currency_type="USD",payment_amount*${ngn} - product*100,payment_amount - product*100))) as revenue FROM payment_history where payment_status="completed" and created_at LIKE "${from || to}%"`
    } else {
        sql = `Select SUM(ceil(IF(currency_type="USD",payment_amount*${ngn} - product*100,payment_amount - product*100))) as revenue FROM payment_history  where payment_status="completed"`
    }
    try {
        let revenue = await db.query(sql)
        res.json({ status: true, revenue: revenue[0].revenue || 0 })
    } catch (err) { console.log(err) }
})

async function getPermission(tab, req) {
    let permissions = await db.query(`SELECT permissions,isSuperAdmin FROM permissions p right join users u on u.id= p.user_id WHERE u.id = ?`, [req.session.id])
    if (permissions[0].isSuperAdmin) {
        return true
    }
    if (tab != 'navigation') {
        permissions = permissions[0] && permissions[0].permissions ? permissions[0].permissions.trim().split(" ") : []
        if (permissions.includes(tab)) {
            return true
        } else {
            return false
        }
    } else {
        return { permissions: permissions[0].permissions.trim().split(" ") }
    }
}

function unauthorized(res, req) {
    req.flash("msg_error", "You are not authorized access to some of the contents of this site. Please Contact Superadmin")
    res.redirect("/controlpanel/dashboard")
}

app.get("/reported", mw.LoggedIn, mw.IsAdmin, async function (req, res) {
    let reports = await db.query(`select users.firstname,users.email,inbox.message,(select firstname from users where users.id=inbox.to_id) as reporter from inbox inner join users on users.id=inbox.from_id where inbox.flagged=1`)
    res.render("admin/reports", { users: reports })
})

app.get("/credits", mw.LoggedIn, mw.IsAdmin, async function (req, res) {
    let usercredits = await db.query(`SELECT u.id,u.email, u.firstname,u.lastname,ud.credit_balance FROM users u INNER JOIN user_details ud ON u.id=ud.user_id `)
    res.render("admin/credits", { users: usercredits })
})
module.exports = app
