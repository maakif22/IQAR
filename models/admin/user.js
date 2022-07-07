const
    db = require('../db'),
    mail = require('../mail'),
    hl = require('handy-log'),
    P = require('bluebird'),
    fs = require('fs'),
    path = require('path'),
    dir = process.cwd()



const userlist = (req, res) => {
    let flagCondition = ' AND users.flag !=1'
    let { from, to, status, country } = req.query
    let filter = ""
    if (to && from) {
        filter = ` AND users.joined BETWEEN DATE('${from}') AND DATE('${to}')`
    } else if (to || from) {
        filter = ` AND users.joined like '${from || to}%'`
    }
    if (status == 'banned') {
        filter += " AND users.flag=1"
        flagCondition = ""
    }
    if (status == 'suspended') {
        filter += " AND users.status = 0 and users.flag!=1"
    }
    if (country && country != -1) {
        filter += ` AND user_details.country = '${country}'`
    }

    P.coroutine(function* () {
        let rows = yield db.query(`Select users.*,user_details.phone, user_details.bank_name,user_details.bank_acc_no,user_details.bank_code,user_details.country from users JOIN user_details on users.id = user_details.user_id WHERE users.isadmin !=1 ${flagCondition} ${filter}`);
        res.render("admin/users", { users: rows, query: req.query });
    })()
}

const gamelist = (req, res) => {
    P.coroutine(function* () {
        let rows = yield db.query('Select CONCAT(u.firstname,u.lastname) as name, u.email,ud.credit_balance,g.game_name,ps.total_battles,ps.battles_won,ps.battles_lost from users u JOIN user_details ud on u.id = ud.user_id INNER JOIN player_statistics ps on ps.user_id=u.id LEFT JOIN games g on ps.game_id= g.id WHERE u.isadmin !=1 AND flag !=1');
        if (rows.length == 0) {
            res.json({ mssg: "No User found!" });
        } else if (rows.length > 0) {
            res.render("admin/gamestatistics", { games: rows });
        }
    })()
}
const userDoc = (req, res) => {
    P.coroutine(function* () {
        let rows = yield db.query('Select us.id, us.email, us.firstname, ud.phone, ud.verification_status, ud.vdoc from users us JOIN user_details ud on us.id = ud.user_id WHERE us.isadmin !=1');
        if (rows.length == 0) {
            res.json({ mssg: "No User found!" });
        } else if (rows.length > 0) {
            res.render("admin/vdoc", { users: rows });
        }
    })()
}

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


module.exports = {
    userlist,
    userDoc,
    gamelist
}
