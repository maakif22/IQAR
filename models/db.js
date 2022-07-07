const
    db = require('./mysql'),
    mail = require('../models/mail'),
    root = process.cwd(),
    bcrypt = require('bcrypt-nodejs'),
    crypto = require('crypto'),
    url = require("url"),
    fs = require('fs'),
    path = require("path"),
    request = require("request"),
    spamlist = require("./spamfilterlist.json");

const query = (q, data) => {
    return new Promise((resolve, reject) => {
        db.query(q, data, (err, res) => {
            err ? reject(err) : resolve(res)
        })
    })
}

const createUser = (user, newUserDetail) => {
    return new Promise((resolve, reject) => {
        bcrypt.hash(user.password, null, null, (error, hash) => {
            user.password = hash
            db.query('INSERT INTO users SET ?', user, (err, res) => {

                if (err) {
                    return reject(err);
                }
                newUserDetail.user_id = res.insertId;

                db.query('INSERT INTO user_details SET ?', newUserDetail, (err, res) => {
                })
                err ? reject(err) : resolve(res)
            })
        })
    })
}

const updatePassword = (email, password) => {
    return new Promise((resolve, reject) => {
        bcrypt.hash(password, null, null, (error, hash) => {
            password = hash;
            db.query('UPDATE `users` SET `password` = ?, `resetPasswordToken` = ?, `resetPasswordExpires` = ? WHERE  email=?', [password, '', '', email], (err, res) => {

                if (err) {
                    return reject(err);
                }
                resolve(res);
            })
        })
    })
}

const AddDevice = (data) => {

    return new Promise((resolve, reject) => {

        db.query('SELECT * FROM `login_session` where user_id=?', [data.user_id], (err, rows, res) => {
            if (err) { return reject(err); }
            if (rows.length > 0) {
                db.query('UPDATE `login_session` SET `token` = ? WHERE  user_id=?', [data.token, data.user_id])

            } else {
                db.query('INSERT INTO login_session SET ?', Object.assign({}, data))
            }
            resolve(res);
        })

        //res.json(Object.assign({}, insert, {status:2 } ))

    })
}

const updateToken = (email, req, res) => {
    return new Promise((resolve, reject) => {

        crypto.randomBytes(20, function (err, buf) {
            var token = buf.toString('hex');

            db.query('UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?', [token, Date.now(), email], (err, res) => {
                db.query(`Select firstname from users where email = ?`, [email], (err, result) => {
                    username = result[0].firstname
                    if (err) { console.log(err); reject(err); }

                    let options = {
                        to: email,
                        subject: 'Password reset request',
                    }

                    let renderable = {
                        template: path.join("emails", "users", "forgotpass.html"),
                        locals: {
                            host: req.hostname,
                            username: username,
                            token: token,
                            url: url
                        }
                    }
                    mail(options, renderable).then(_ => {
                        console.log("Mail sent")
                    }).catch(err => {
                        console.log(err)
                    })
                    resolve(res);
                })
            })

        })
    })
}

const addActivity = (activity) => {

    return new Promise((resolve, reject) => {
        db.query('INSERT INTO last_activity SET ?', activity, (err, res) => {

            if (err) {
                return reject(err);
            }
            resolve(res);
        })
    })
}

const updateActivity = (status, id) => {
    return new Promise((resolve, reject) => {
        db.query('UPDATE users SET online=? WHERE id=?', [status, id], (err, res) => {
            if (err) {
                return reject(err);
            }
            resolve(res);
        })
    })
}

const updateUserStatus = (status, id) => {
    db.query("SELECT email,status,firstname from users where id = ?", [id], (err, rows, fields) => {
        let email = rows[0].email
        let userStat = rows[0].status
        let firstname = rows[0].firstname
        var sql, accountStat, templatePath, subject;
        if (status == 'delete') {
            status = 1
            accountStat = 'Suspended'
            templatePath = path.join("emails", "users", "accountdeleted.html")
            subject = "Notification of account deletion"
            sql = 'UPDATE users SET flag = ? WHERE id= ?';
        } else {
            accountStat = userStat ? 'Deactivated' : 'Activated'
            templatePath = accountStat == 'Deactivated' ? path.join("emails", "users", "accountsuspended.html") : path.join("emails", "users", "accountsuspensionlifted.html")
            subject = accountStat == 'Deactivated' ? "Notification of account suspension" : "Notification of account suspension lifting"
            sql = 'UPDATE users SET status = ? WHERE id= ?';
        }
        return new Promise((resolve, reject) => {
            db.query(sql, [status, id], (err, res) => {

                if (err) {
                    return reject(err);
                }
                let options = {
                    to: email,
                    subject: subject,
                }

                let renderable = {
                    template: templatePath,
                    locals: {
                        username: firstname
                    }
                }
                mail(options, renderable).then(_ => {
                    console.log("Mail sent")
                }).catch(err => {
                    console.log(err)
                })

                resolve(res);
            })
        })
    })
}

const updateVerificationStatus = (status, id) => {
    return new Promise((resolve, reject) => {
        db.query('UPDATE user_details SET verification_status= ? WHERE user_id= ?', [status, id], (err, res) => {
            if (err) {
                return reject(err);
            }
            resolve(res);
        })
    })
}

const getVerificationStatus = (user_id) => {
    return new Promise((resolve, reject) => {
        db.query('SELECT verification_status FROM user_details WHERE user_id= ?', [user_id], (err, res) => {

            if (err) {
                return reject(err);
            }
            resolve(res);
        })
    })
}

const fileFilter = (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|jpeg|gif)$/)) {
        return cb(new Error('Only pdfs are allowed'))
    }
    cb(null, true)
}

const page = (slug) => {
    return new Promise((resolve, reject) => {
        db.query('select * from pages where slug = ?', slug, (err, res) => {
            if (err) {
                return reject(err);
            }
            resolve(res);
        })
    })
}

const IsUserLoggedOnElsewhere = (user_id) => {
    return new Promise(function (resolve, reject) {
        db.query("SELECT * FROM login_session WHERE user_id=?", [user_id], function (err, row) {
            if (row === undefined) {
                reject(err);
            } else {
                resolve(row);
            }
        })
    })
}

const comparePassword = (password, hash) => {
    return new Promise((resolve, reject) => {
        bcrypt.compare(password, hash, (err, res) => {
            err ? reject(err) : resolve(res)
        })
    })
}

const selectQry = (area, mid) => {
    if (area == 'sent') {
        update_field = 'del_from';
        where_field = 'from_id';
        sql = 'SELECT del_from, del_to FROM `inbox` where from_id=' + req.session.id + ' and id=' + mid;
    } else {
        update_field = 'del_to';
        where_field = 'to_id';
        sql = 'SELECT del_from, del_to FROM `inbox` where to_id=' + req.session.id + ' and id=' + mid;
    }
    return db.query(sql);
};

const callbackClosure = (i, callback) => {
    return function () {
        return callback(i);
    }
}

const updatePushId = (user_id, push_id) => {
    db.query("UPDATE user_details SET push_id= ? where push_id = ?", ['', push_id], (err, rows, fields) => {
        if (err) console.log(err)
        db.query("UPDATE user_details SET push_id = ? where user_id = ?", [push_id, user_id], err => { if (err) console.log(err) })
    })

}

const terminateUsers = (id) => {
    try {
        db.query(`DELETE FROM  users where id=?`, [id])
    } catch (err) {
        console.log(err)
    }
}

const allUserInbox = (req, res, redirectpath) => {
    let sql = 'SELECT inbox.*,(SELECT firstname FROM users WHERE id=inbox.from_id) AS from_name,(SELECT firstname FROM users WHERE id=inbox.to_id) AS to_name,user_details.profile_pic, users.firstname,users.gender FROM `inbox` JOIN users ON inbox.from_id = users.id LEFT JOIN user_details ON users.id = user_details.user_id ORDER BY inbox.thread_id DESC'
    db.query(sql, function (err, rows, fields) {
        if (err) throw err;
        res.render(redirectpath, { inbox: rows })
    });
}

function spamFilter(rows) {
    rows.map(msg => {
        let message = msg.message;
        spamlist.wordlist.forEach(word => {
            if (message.includes(word) || new RegExp(word, "i").test(message)) {
                message = message.replace(new RegExp(`\\b${word}\\b`, "gi"), "*****");
            }
        });
        return msg.message = message;
    });
    return rows
}

function transactionLog(req, res, data) {
    let date = new Date()
    date = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()
    let filename = `${date}_mvanadium.csv`
    let fileExist = fs.existsSync(root + "/transactionHistory/" + filename)
    let { payment_id, user_id, payment_amount, currency, product } = data
    if (fileExist) {
        createLog(payment_id, user_id, req, payment_amount, currency, product, filename);
    } else {
        fs.writeFileSync(`${root}/transactionHistory/${filename}`, "TRANSACTION DATE, TRANSACTION TIME, TRANSACTION ID, USER ID, IP ADDRESS, STATE OF ORIGIN, AMOUNT, CURRENCY, NUMBER OF TOKENS PURCHASED")
        createLog(payment_id, user_id, req, payment_amount, currency, product, filename);
    }
}

function createLog(payment_id, user_id, req, amount, currency, product, filename) {
    db.query(`SELECT ph.*, ud.country, ud.state FROM payment_history ph inner join user_details ud on ph.user_id = ud.user_id WHERE ph.user_id = ${user_id} and(ph.payment_id = "${payment_id}" or ph.payment_token = "${payment_id}")`, [], (err, result, fields) => {
        if (err) console.log(err)
        let date = result[0].created_at
        const records = `\n${date.getFullYear()}/${(date.getMonth() + 1)}/${date.getDate()}, ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}, ${payment_id}, ${user_id}, ${req.headers['x-forwarded-for']}, ${result[0].country}, ${amount}, ${currency}, ${product}`;
        fs.appendFileSync(`${root}/transactionHistory/${filename}`, records)
    });
}

module.exports = {
    query,
    createUser,
    comparePassword,
    page,
    addActivity,
    updateActivity,
    selectQry,
    AddDevice,
    updatePassword,
    callbackClosure,
    IsUserLoggedOnElsewhere,
    fileFilter,
    updateVerificationStatus,
    updateUserStatus,
    updateToken,
    getVerificationStatus,
    updatePushId,
    terminateUsers,
    allUserInbox,
    transactionLog
}


