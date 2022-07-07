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
    configAuth = require('../models/auth'),
    bcrypt = require('bcrypt-nodejs'),
    Jimp = require("jimp"),
    mw = require('../models/middlewares'),
    fs = require('fs'),
    jwt = require('jsonwebtoken'),
    path = require("path"),
    OAuth2 = require('oauth').OAuth2,
    request = require("request"),
    spamlist = require("../models/spamfilterlist.json"),
    admin = require("firebase-admin");

function ensureToken(req, res, next) {
    const bearerHeader = req.headers["authorization"];
    if (typeof bearerHeader !== 'undefined') {
        const bearer = bearerHeader.split(" ");
        const bearerToken = bearer[1];
        req.token = bearerToken;
        next();
    } else {
        res.sendStatus(403);
    }
}

generateError = function (res, text) {
    res.end(JSON.stringify({ error: text }));
}

getPublicUserFromId = function (id, callback) {
    var query = 'SELECT users.firstname, users.lastname, users.email, users.gender, user_details.user_id, user_details.country, user_details.profile_pic from users RIGHT JOIN user_details ON users.id = user_details.user_id WHERE users.id = ' + id;
    db.query(query, function (err, result) {
        callback(err, result);
    });
}

app.post('/login', (req, res) => {
    _login.login(req, res);
});

app.post("/signup", (req, res) => {
    _login.signup(req, res)
})

app.get('/logout', ensureToken, (req, res) => {
    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {
        if (err) {
            res.sendStatus(403);
        } else {
            res.status(200).json({ 'success': true, mssg: 'user logout successfully' });
        }

    });
});

//Forgot password

app.post('/forgot', function (req, res, next) {
    _login.forgot(req, res)
});

// /FOR DETAILS OF GIVEN USER
app.post('/get_details', ensureToken, (req, res) => {
    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {
        if (err) {
            res.sendStatus(403);
        } else {
            db.query('SELECT * FROM users WHERE id=?', [data.user])
                .then(get => res.json(get[0]))
                .catch(err => res.json(err))

        }
    });
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


        Jimp.read(srcFile, function (err, image) {
            if (err) throw err;
            image.crop(x, y, w, h)            // resize
                .quality(100)                 // set JPEG quality
                .greyscale()                 // set greyscale
                .write(destFile); // save
        });

        rslt = yield db.query('UPDATE user_details SET profile_pic=? WHERE user_id=?', [req.body.image_name, req.session.id])

        if (rslt) {
            fs.unlink(srcFile, function (error) {
                if (error) {
                    throw error;
                }

            });
        }
        res.json({ mssg: "Avatar changed!" })

    })()
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

// TO send friend requestf
app.post('/addfriend', ensureToken, (req, res) => {

    if (!req.body.user) {
        generateError(res, 'No user selected to add!');
    }
    //_Bp+W1v,v(+S
    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) { res.sendStatus(403); }

        P.coroutine(function* () {

            let insert = {
                user_one_id: data.user,
                user_two_id: req.body.user,
                status: 0,
                action_user_id: data.user
            }

            let requestValidation = yield db.query('SELECT * FROM relationship WHERE user_one_id = "' + data.user + '" AND user_two_id = "' + req.body.user + '"')
            if (requestValidation.length > 0) {
                generateError(res, 'Friend request already sent!');
            }
            else {
                let addfriend = yield db.query('INSERT INTO relationship SET ?', Object.assign({}, insert))
                let get_status = yield db.query('SELECT status FROM relationship WHERE id=? LIMIT 1', [addfriend.insertId])
                if (get_status[0].status == 0) {
                    res.end(JSON.stringify({ success: 'True', message: 'Friend request sent successfully!', friendId: insert.user_two_id }));
                }
            }

            //res.json(Object.assign({}, insert, {status:get_status[0].status } ))
        })()
    });
})

/**
* To cancel friend request
*/
app.post('/cancelRequest', ensureToken, (req, res) => {

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) {
            res.sendStatus(403);
        }
        var query0 = 'DELETE FROM relationship WHERE user_one_id = "' + data.user + '" and user_two_id = "' + req.body.user + '"';
        //db.query('DELETE FROM `relationship` WHERE `user_one_id` = ? and `user_two_id` = ?', [data.user, req.body.id])
        //res.json(Object.assign({}, {status:true } ))
        db.query(query0, function (err, result) {
            if (err) {
                generateError(res, 'Error canceling request!');
            }
            else {
                var _result = JSON.parse(JSON.stringify(result));
                if (_result.affectedRows > 0) {
                    res.end(JSON.stringify({ success: 'True', message: 'Request cancelled!' }));
                }
                else {
                    generateError(res, 'Error canceling request!');
                }
            }
        });
    });
})

/**
* To accept friend request
*/
app.post('/acceptRequest', ensureToken, (req, res) => {

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) {
            res.sendStatus(403);
        }

        if (!req.body.id) {
            generateError(res, 'No user selected!');
        }

        P.coroutine(function* () {
            var query0 = 'UPDATE relationship SET status = "1", action_user_id = "' + data.user + '" WHERE user_one_id = "' + req.body.id + '" AND user_two_id = "' + data.user + '"';
            //let acceptRequest = yield db.query('UPDATE `relationship` SET `status` = ? , `action_user_id` = ? WHERE `user_one_id` = ? AND `user_two_id` = ?', [1, data.user, req.body.id, data.user])
            let acceptRequest = yield db.query(query0);

            var _result = JSON.parse(JSON.stringify(acceptRequest));
            if (_result.affectedRows > 0) {
                res.end(JSON.stringify({ success: 'True', message: 'Friend request accepted!', otherUserId: req.body.id }));
            }
            else {
                generateError(res, 'Error accepting request');
            }


        })()
    });
})

/**
* To decline friend request
*/
app.post('/declineRequest', ensureToken, (req, res) => {

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) {
            res.sendStatus(403);
        }

        var query0 = 'DELETE FROM relationship WHERE user_one_id = "' + req.body.id + '" and user_two_id = "' + data.user + '"';
        db.query(query0, function (err, result) {
            if (err) {
                generateError(res, 'Error declining request!');
            }
            else {
                if (JSON.parse(JSON.stringify(result)).affectedRows > 0) {
                    res.end(JSON.stringify({ success: 'True', message: 'Request declined successfully!' }));
                }
                else {
                    generateError(res, 'Error declining request!');
                }
            }
        });

    });
})

/**
* To unfriend
*/
app.post('/unfriend', ensureToken, (req, res) => {

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) {
            res.sendStatus(403);
        }

        db.query('DELETE FROM `relationship` WHERE (`user_one_id` = ? and `user_two_id` = ?) or (`user_one_id` = ? and `user_two_id` = ?)', [req.body.id, req.body.user, req.body.user, req.body.id])
        res.json(Object.assign({}, { status: true }))
    });
})

/**
* To delete message
*/
app.post('/delmsg', ensureToken, (req, res) => {

    /*if(!req.session.id){
        res.status(400).json({error:true, mssg:'Something is wrong'});
        return;
    }*/
    if (!req.token) {
        generateError(res, 'Error authenticating user!');
        return;
    }

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {
        if (err) {
            generateError(res, 'Error authenticating user!');
            return;
        }


        var sql, update_field, where_field;
        var area = req.body.area;
        var ids = JSON.parse(req.body.ids);
        ids.forEach(function (mid) {

            if (area == 'outbox' || area == 'sent') {
                update_field = 'del_from';
                where_field = 'from_id';
                sql = 'SELECT del_from, del_to FROM `inbox` where from_id=' + data.user + ' and id=' + mid;
            } else {
                update_field = 'del_to';
                where_field = 'to_id';
                sql = 'SELECT del_from, del_to FROM `inbox` where to_id=' + data.user + ' and id=' + mid;
            }

            db.query(sql, function (err, result, fields) {
                if (err) throw err;
                if (result[0].del_from == 1 || result[0].del_to == 1) {

                    db.query('DELETE FROM `inbox` WHERE id = ?', [mid])

                }
                else {
                    //let sq = 'UPDATE `inbox` SET '+update_field+' = 1 WHERE '+where_field+' = '+req.session.id+' and id='+mid;
                    let sq = 'UPDATE `inbox` SET ' + update_field + ' = ? WHERE ' + where_field + ' = ? and id=?';
                    db.query(sq, [1, data.user, mid])
                }
            });

        });
        res.json(Object.assign({}, { success: true }))


    });

    //alert(req.body.ids);
    /*  var sql, update_field, where_field;
      var area = req.body.area;
      var ids = req.body.ids;

    ids.forEach(function(mid) {

      if(area == 'outbox'){
               update_field = 'del_from';
               where_field = 'from_id';
          sql = 'SELECT del_from, del_to FROM `inbox` where from_id='+req.session.id+' and id='+mid;
      }else{
           update_field = 'del_to';
           where_field = 'to_id';
          sql = 'SELECT del_from, del_to FROM `inbox` where to_id='+req.session.id+' and id='+mid;
      }

      db.query(sql, function(err, result, fields) {
      if (err) throw err;

      if (result[0].del_from == 1 || result[0].del_to == 1) {

            db.query('DELETE FROM `inbox` WHERE id = ?', [mid])

          }
      else
       {
          //let sq = 'UPDATE `inbox` SET '+update_field+' = 1 WHERE '+where_field+' = '+req.session.id+' and id='+mid;
          let sq = 'UPDATE `inbox` SET '+update_field+' = ? WHERE '+where_field+' = ? and id=?';
            db.query(sq,[1, req.session.id, mid])
       }
      });

      });
      res.json(Object.assign({}, {success:true } ))*/

})

/**
* To block user
*/
app.post('/blockUser', ensureToken, (req, res) => {

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) { res.sendStatus(403); }

        P.coroutine(function* () {

            let insert = {
                user_one_id: req.body.id,
                user_two_id: req.body.user,
                status: 2,
                action_user_id: req.body.id
            }

            let relationship;
            db.query('SELECT * FROM `relationship` where ((user_one_id=' + req.body.id + ' and user_two_id=' + req.body.user + ') or (user_one_id=' + req.body.user + ' and user_two_id=' + req.body.id + ')) and status=1')
                .then(rows => {
                    relationship = rows;
                    if (rows.length > 0) {
                        db.query('UPDATE `relationship` SET `status` = 2 WHERE (`user_one_id` = ' + req.body.id + ' and user_two_id=' + req.body.user + ') or (`user_one_id` = ' + req.body.user + ' and user_two_id=' + req.body.id + ')')
                    }
                    else {
                        db.query('INSERT INTO relationship SET ?', Object.assign({}, insert))
                    }
                    res.json(Object.assign({}, insert, { status: 2, success: true }))
                })
                .catch(err => generateError(res, err))

        })()
    });
});

/**
* To unblock
*/
app.post('/unblockUser', (req, res) => {

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) { res.sendStatus(403); }

        db.query('DELETE FROM `relationship` WHERE (`user_one_id` = ? and `user_two_id` = ?) or (`user_one_id` = ? and `user_two_id` = ?)', [req.body.id, req.body.user, req.body.user, req.body.id])
        res.json(Object.assign({}, { status: true }))
    });
});

// FOR sending message
app.post('/sendMessage', ensureToken, (req, res) => {

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) {
            res.sendStatus(403);
        }
        var query0 = 'INSERT INTO inbox SET from_id = "' + data.user + '", to_id = "' + req.body.to_id + '", subject = "' + req.body.subject + '", message = "' + req.body.message + '", thread_id="' + Date.now() + '",created_on ="' + new Date().toISOString().slice(0, 19).replace('T', ' ') + '"';
        db.query(query0, function (err, result) {
            if (err) {
                console.log(err)
                generateError(res, 'Error sending message!');
            }
            else {
                var _result = JSON.parse(JSON.stringify(result));
                if (_result.affectedRows > 0) {
                    res.end(JSON.stringify({ success: 'True', message: 'Message sent successfully!' }));
                }
                else {
                    generateError(res, 'Some error occured!');
                }
            }
        });

    });
});


app.get('/friends1', function (req, res) {
    db.query('SELECT id, email, firstname from users where firstname like "%' + req.query.friend_name + '%" and id !=' + req.body.id, function (err, rows, fields) {
        if (err) throw err;

        res.end(JSON.stringify(rows));
    });
});/**/

app.get('/usr', function (req, res) {
    db.query('SELECT id, email, firstname from users where firstname like "%' + req.query.friend_name + '%" and id !=' + req.body.id, function (err, rows, fields) {
        if (err) throw err;

        res.end(JSON.stringify(rows));
    });
});/**/

app.get('/friends', ensureToken, function (req, res) {

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) {
            res.sendStatus(403);
        } else {

            let profile, friends, requests;
            db.query('SELECT c.profile_pic,b.id,b.firstname, b.email, a.status FROM `relationship` as a JOIN users as b on (a.user_one_id=b.id and a.user_one_id!=' + req.session.id + ') or (a.user_two_id=b.id and a.user_two_id!=' + req.session.id + ') left join user_details as c on b.id = c.user_id WHERE (a.`user_one_id` = ' + req.session.id + ' OR a.`user_two_id` = ' + req.session.id + ') AND a.`status` = 1')
                .then(rows => {
                    friends = rows;
                    return db.query('SELECT a.*,c.profile_pic,b.firstname,b.email FROM `relationship` as a join users as b on b.id=a.user_one_id left join user_details as c on b.id = c.user_id where a.user_two_id=' + req.session.id + ' and a.status=0');
                })
                .then(rows => {
                    requests = rows;
                    return db.query('Select users.*, user_details.* from users JOIN user_details on (users.id=user_details.user_id) where users.id = ' + req.session.id + ' limit 1 ');
                })
                .then(rows => {
                    profile = rows[0];
                })
                .then(() => {
                    res.status(200).json({ profile: profile, rows: requests, friends: friends, id: req.params.id, userId: req.session.id })
                });

        }
        // res.json({userId:req.session.id } )
    });
});


app.get('/onlinefriends', ensureToken, (req, res) => {
    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        var query0 = 'SELECT b.id user_id, b.firstname, b.lastname, b.email, c.profile_pic, c.country, c.push_id, a.status FROM `relationship` as a JOIN users as b on (a.user_one_id=b.id and a.user_one_id!=' + data.user + ') or (a.user_two_id=b.id and a.user_two_id!=' + data.user + ') left join user_details as c on b.id = c.user_id WHERE (a.`user_one_id` = ' + data.user + ' OR a.`user_two_id` = ' + data.user + ') AND a.`status` = 1 AND b.Online="y"';

        db.query(query0, function (err0, result0) {
            if (err0) {
                generateError(res, 'Error retrieving online friends!');
            }
            else {
                var _result0 = JSON.parse(JSON.stringify(result0));
                if (_result0.length == 0) {
                    generateError(res, 'No friend is online!');
                }
                else {
                    res.end(JSON.stringify({ data: _result0 }));
                }
            }

        });
    });
})


app.get('/inbox', ensureToken, (req, res) => {
    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        var query0 = 'SELECT inbox.*, users.firstname, users.lastname, users.email, users.gender, user_details.user_id, user_details.country, user_details.profile_pic FROM inbox JOIN users ON inbox.from_id = users.id LEFT JOIN user_details ON users.id = user_details.user_id WHERE (inbox.to_id = "' + data.user + '" or inbox.to_id = 0)  and inbox.del_to !=1 order by inbox.id DESC';
        db.query(query0, function (err0, result0) {
            if (err0) {
                generateError(res, 'Error retrieving messages!');
            }
            else {
                var _result0 = JSON.parse(JSON.stringify(result0));
                if (_result0.length == 0) {
                    generateError(res, 'No messages in inbox!');
                }
                else {
                    res.end(JSON.stringify({ data: spamFilter(_result0) }));
                }
            }

        });

        /*var id = req.body.id;

        if (err) {res.sendStatus(403);}

        let inbox;
        db.query('SELECT inbox.*, user_details.profile_pic, users.firstname FROM `inbox` join users on inbox.from_id = users.id left join user_details on users.id = user_details.user_id where inbox.to_id = '+id+' and inbox.del_to !=1')
        .then( rows => {
            inbox = rows;})
        .then( () => {
            return res.status(200).json({inbox:inbox} )
        });*/
    });

})

app.get('/sent', ensureToken, (req, res) => {

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        // var query0 = 'SELECT inbox.*, users.firstname, users.lastname, users.email, users.gender, user_details.user_id, user_details.country, user_details.profile_pic FROM inbox JOIN users ON inbox.from_id = users.id LEFT JOIN user_details ON users.id = user_details.user_id WHERE inbox.from_id = "' + data.user + '"';
        var query0 = 'SELECT inbox.*,user_details.profile_pic, users.firstname,users.lastname,users.gender FROM `inbox` join users on inbox.to_id = users.id left join user_details on users.id = user_details.user_id where inbox.from_id = ' + data.user + ' and inbox.del_from !=1 order by inbox.id DESC'
        db.query(query0, function (err0, result0) {
            if (err0) {
                generateError(res, 'Error retrieving messages!');
            }
            else {
                var _result0 = JSON.parse(JSON.stringify(result0));
                if (_result0.length == 0) {
                    generateError(res, 'No messages in outbox!');
                }
                else {
                    res.end(JSON.stringify({ data: spamFilter(_result0) }));
                }
            }

        });
        /*var id = req.body.id;

        if (err) {res.sendStatus(403);}
        let outbox;
        db.query('SELECT inbox.*,user_details.profile_pic, users.firstname FROM `inbox` join users on inbox.to_id = users.id left join user_details on users.id = user_details.user_id where inbox.from_id = '+id+' and inbox.del_from !=1')
        .then( rows => {
            outbox = rows;})
        .then( () => {
            return res.status(200).json({outbox:outbox} )
            });*/
    });
})


app.post('/changepassword', ensureToken, function (req, res) {


    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {
        var id = req.body.id;
        if (err) {
            res.sendStatus(403);
        }
        db.query('Select password from `users` WHERE `id` = ? ', [id])
            .then(rows => {
                bcrypt.compare(req.body.oldPass, rows[0].password, (err, resIn) => {
                    if (resIn == true) {

                        bcrypt.hash(req.body.password, null, null, (error, hash) => {
                            req.body.password = hash

                            db.query('UPDATE `users` SET `password` = ?  WHERE `id` = ? ', [req.body.password, id])
                                .then(update => res.json({ update, success: true, uid: id }))
                                .catch(err => res.json(err))
                        })

                    } else {
                        generateError(res, "Old password is incorrect.")
                    }
                })
            })
            .catch(err => res.json(err))

    });

});

/**
*User details for editing profile/
*/
app.get('/myprofile/:id', ensureToken, (req, res) => {


    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) {
            generateError(res, 'Error retrieving details!');
        }
        else {
            let profile;

            db.query('Select users.*, user_details.* from users JOIN user_details on (users.id=user_details.user_id) where users.id = ' + req.params.id + ' limit 1 ')
                .then(rows => {
                    profile = rows[0];
                })
                .then(() => {
                    res.status(200).json({ profile: profile })
                });
        }

    });
})

/**
*For edit profile info
*/
app.post('/editmyprofile', ensureToken, function (req, res) {
    console.log(req.body)
    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (req.body.firstname == '' || req.body.firstname == null || req.body.firstname == undefined) {
            generateError(res, 'Firstname is mandatory');
        }

        if (err) {
            generateError(res, 'Error saving data!');
        }
        else {

            jwt.verify(req.token, process.env.SECRET_KEY, function (err1, data1) {
                if (err) {
                    generateError(res, 'Invalid user!');
                }
                else {

                    var query0 = 'SELECT firstname, email from users where id = "' + data.user + '"';

                    db.query(query0, function (err0, result0) {
                        if (err0) {
                            generateError(res, 'Error retrieving user data');
                        }
                        else {
                            var _result0 = JSON.parse(JSON.stringify(result0));
                            if (_result0.length > 0) {
                                var query1 = 'UPDATE users SET gender = "' + req.body.gender + '",firstname= "' + req.body.firstname + '", lastname = "' + req.body.lastname + '" WHERE id = "' + data.user + '"';
                                db.query(query1, function (err1, result1) {
                                    if (err1) {
                                        generateError(res, 'Error updating profile!');
                                    }
                                    else {
                                        var query2 = 'UPDATE user_details SET country="' + req.body.country + '",phone = "' + req.body.phone + '", res_address = "' + req.body.res_address + '", user_age="' + req.body.age + '" WHERE user_id = "' + data.user + '"';
                                        console.log(query2)
                                        db.query(query2, function (err2, result2) {
                                            if (err2) {
                                                generateError(res, 'Some fields are not updated. Contact admin');
                                            }
                                            else {
                                                res.end(JSON.stringify({ message: 'Profile updated successfully', success: 'True' }));
                                            }
                                        });
                                    }
                                });
                            }
                            else {
                                generateError(res, 'User not found!');
                            }
                        }
                    });

                }
            });


        }


    });



});

/**
*For edit bank info
*/
app.post('/editbankdetails', ensureToken, function (req, res) {
    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) {
            generateError(res, 'Bad Request!');
        }
        let { body: { id, bank_name, bank_acc_no, bank_acc_name, bank_code, updatecall, branch_name } } = req

        if (updatecall) {
            
            req.checkBody('id', 'User id is empty').notEmpty()
            req.checkBody('bank_name', 'Bank Name is empty').notEmpty()
            req.checkBody('bank_acc_no', 'Bank Acc Number is empty').notEmpty()
            req.checkBody('bank_acc_name', 'Bank Acc Name is empty').notEmpty()
            let errors = req.validationErrors()
            if (errors) {
                let array = []
                for (let item of errors) {
                    array.push(item.msg)
                }
                return res.json({ mssg: array })
            } else {
                let branchcond = ''
                branchcond = `,branch_name = "${branch_name}"`

                db.query('UPDATE `user_details` SET bank_name = ?, bank_acc_no = ?, bank_acc_name = ?, bank_code = ?' + branchcond + ', verification_status = ? WHERE `user_id` = ? ',
                    [bank_name, bank_acc_no, bank_acc_name, bank_code, 1, id])
                    .then(rows => {
                        return db.query('SELECT bank_name, bank_acc_name, bank_acc_no, bank_code FROM user_details WHERE user_id= ?', id);
                    })
                    .then(rows => {
                        res.json({ status: true })
                    }).catch(err => {
                        generateError(res, err)
                    })
            }
        } else {
            db.query('SELECT bank_name, bank_acc_name, bank_acc_no, bank_code FROM user_details WHERE user_id= ?', id)
                .then(rows => {
                    return res.status(200).json({ bankdetails: rows[0] });
                })
        }
    })
});
/**
  Sale token api
 **/
app.post('/saletoken', ensureToken, (req, res) => {

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {
        if (err) { generateError(res, 'Bad Request!'); }
        let { body: { id, rcredits, currency, redeemRequest } } = req
        let redeemHistory = { user_id: id, redeem_amount: rcredits, currency: currency, status: '0' }
        let credits;
        console.log(req.body)
        if (redeemRequest) {
            req.checkBody('id', 'User id is empty').notEmpty()
            req.checkBody('rcredits', 'Redeem Credits field is empty').notEmpty()
            req.checkBody('currency', 'Currency field is empty').notEmpty()
            console.log('my testing'+rcredits);
            let errors = req.validationErrors()
            if (errors) {
                let array = []
                for (let item of errors) {
                    array.push(item.msg)
                }
                return res.json({ mssg: array })
            } else {

                db.getUserCreditBalance(id)
                    .then(function (result) {
                        let left_balance = result[0].credit_balance - rcredits;

                        if (left_balance >= 0) {

                            db.addRedeemHistory(redeemHistory)
                                .then(function (result) {
                                    db.updateBalance(left_balance, id)
                                       .then(function(result){

                             db.query(`Select u.firstname,u.email, ud.bank_name,ud.bank_acc_no,ud.bank_acc_name from users u LEFT JOIN user_details ud ON u.id = ud.user_id where u.id = ?`, [id], (err, result) => {
                                username = result[0].firstname
                                bank_name = result[0].bank_name
                                bank_acc_name = result[0].bank_acc_name
                                bank_acc_no = result[0].bank_acc_no
                                if (err) { console.log(err); reject(err); }

                                let options = {
                                    to: result[0].email,
                                    subject: 'Notification of successful OneUp token sale',
                                }

                                let renderable = {
                                    template: path.join("emails", "users", "saletoken.html"),
                                    locals: {
                                        host: req.hostname,
                                        username: username,
                                        bank_name: bank_name,
                                        bank_acc_name: bank_acc_name,
                                        bank_acc_no: bank_acc_no,
                                        amount: rcredits
                                          
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
                                    return res.status(200).json({ mssg: 'Request sent successfully' });
                                })

                        } else {
                            return generateError(res, "Insufficient balance");
                        }
                    })
            } //Else condition end
        } else {

            db.getUserCreditBalance(id)
                .then(function (result) {
                    return res.status(200).json({ balance: result[0].credit_balance });
                })

        }
    })

});

/*
For search friends //gender, user_id, country, profile_pic
*/
app.post('/search', ensureToken, function (req, res) { //console.log(req.session);


    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {
        if (err) {
            console.log(err)
            generateError(res, 'Unable to authenticate user!');
        }
        else {
            let allIds = []
            var query = `SELECT users.firstname, users.lastname, users.email, users.gender, user_details.user_id, user_details.push_id, user_details.country, user_details.profile_pic FROM users RIGHT JOIN user_details ON users.id = user_details.user_id  WHERE users.id != ${data.user} AND user_id NOT IN (SELECT user_one_id FROM relationship WHERE (user_one_id = ${data.user} OR user_two_id =${data.user}) and status=2) AND user_id NOT IN (SELECT user_two_id FROM relationship WHERE (user_one_id = ${data.user} OR user_two_id = ${data.user}) and status=2)`;
            console.log(query)
            db.query(query, function (err, result) {
                if (err) throw err;
                else {
                    var _result = JSON.parse(JSON.stringify(result));

                    var data = [];
                    for (var i = 0; i < _result.length; i++) {
                        var temp = _result[i].firstname.toLowerCase().indexOf(req.body.searchKey.toLowerCase());
                        if (temp >= 0) {
                            data.push(_result[i]);
                        }
                    }
                    console.log("search", data)
                    res.end(JSON.stringify({ searchResult: data }));
                }
            });
        }
    });

});

app.get('/getAllSentRequests', ensureToken, function (req, res) {
    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {
        if (err) {
            generateError(res, 'Error authenticating user!');
        }
        var userId = data.user;
        P.coroutine(function* () {

            let query = yield db.query('SELECT * FROM relationship WHERE user_one_id = "' + data.user + '" AND status = "' + 0 + '"');
            var _result0 = JSON.parse(JSON.stringify(query));
            if (_result0.length > 0) {
                var allIds = [];
                for (var i = 0; i < _result0.length; i++) {
                    allIds.push(_result0[i].user_two_id);
                }
                var allIdString = allIds.join(',');
                var queryString = 'SELECT users.firstname, users.lastname, users.email, users.gender, user_details.user_id, user_details.country, user_details.profile_pic from users RIGHT JOIN user_details ON users.id = user_details.user_id WHERE users.id IN (' + allIdString + ')';
                var query1 = yield db.query(queryString);
                var _result = JSON.parse(JSON.stringify(query1));
                res.end(JSON.stringify({ data: _result }));
            }
            else {
                generateError(res, 'No friend requests found!');
            }
        })()
    });
});

app.get('/allfriends', ensureToken, function (req, res) {
    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {
        if (err) {
            generateError(res, 'Error fetching friends!');
            return;
        }

        var query0 = 'SELECT * FROM relationship WHERE (user_one_id = "' + data.user + '" OR user_two_id = "' + data.user + '") AND status = "1"';
        db.query(query0, function (err0, result0) {
            if (err0) {
                generateError(res, 'Error fetching friends!');
            }
            else {
                P.coroutine(function* () {
                    var _result0 = JSON.parse(JSON.stringify(result0));
                    if (_result0.length > 0) {
                        var allIds = [];
                        for (var i = 0; i < _result0.length; i++) {
                            var targetId = null;
                            if (_result0[i].user_one_id == data.user) {
                                targetId = _result0[i].user_two_id;
                            }
                            else {
                                targetId = _result0[i].user_one_id;
                            }
                            allIds.push(targetId);
                        }
                        var allIdString = allIds.join(',');
                        var queryString = 'SELECT users.firstname, users.lastname, users.email, users.gender, user_details.user_id, user_details.push_id, user_details.country, user_details.profile_pic from users RIGHT JOIN user_details ON users.id = user_details.user_id WHERE users.id IN (' + allIdString + ')';
                        var query1 = yield db.query(queryString);
                        var _result = JSON.parse(JSON.stringify(query1));
                        res.end(JSON.stringify({ data: _result }));
                    }
                    else {
                        generateError(res, 'No friend found!');
                    }
                })()

            }
        });
    });
});

app.get('/getAllFriendRequests', ensureToken, function (req, res) {
    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {
        if (err) {
            generateError(res, 'Error authenticating user!');
        }
        var userId = data.user;
        P.coroutine(function* () {

            let query = yield db.query('SELECT * FROM relationship WHERE user_two_id = "' + data.user + '" AND status = "' + 0 + '"');
            var _result0 = JSON.parse(JSON.stringify(query));
            if (_result0.length > 0) {
                var allIds = [];
                for (var i = 0; i < _result0.length; i++) {
                    allIds.push(_result0[i].user_one_id);
                }

                var allIdString = allIds.join(',');

                var queryString = 'SELECT users.firstname, users.lastname, users.email, users.gender, user_details.user_id, user_details.country, user_details.profile_pic from users RIGHT JOIN user_details ON users.id = user_details.user_id WHERE users.id IN (' + allIdString + ')';

                var query1 = yield db.query(queryString);
                var _result = JSON.parse(JSON.stringify(query1));
                res.end(JSON.stringify({ data: _result }));
            }
            else {
                generateError(res, 'No friend requests found!');
            }
        })()
    });
});


var storage = multer.diskStorage({
    destination: async function (req, file, callback) {
        var dir
        let wait = new Promise((reject, resolve) => {
            req.on("data", function (err, data) {
                if (err) reject(err)
            })
            req.on("end", function (data) {
                resolve(data)
            })
        })
        try {
            await wait
        } catch (err) {
            console.log(err)
        }

        let user_id = req.body.user_id
        if (req.baseUrl == "/apis/upload_doc") {
            dir = `${root}/public/users/` + user_id + '/doc/';
        } else {
            dir = `${root}/public/users/` + user_id + '/';
        }

        !fs.existsSync(dir) && fs.mkdirSync(dir);

        callback(null, dir)
    },
    filename: function (req, file, callback) {
        var name = 'vdoc'
        if (req.baseUrl == "/apis/profile_image_update") {
            name = 'userAvatar';
        }
        callback(null, name + path.extname(file.originalname))
    }
})

var upload = multer({
    storage: storage, fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|doc|pdf|docx)$/)) {
            console.log('File extension is not correct.')
        }
        cb(null, true)
    }
}).single('add_doc')

app.use("/upload_doc", upload)

app.post('/upload_doc', ensureToken, (req, res) => {

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) {
            generateError(res, 'Error authenticating user!');
        }

        req.checkBody('user_id', 'User id is empty').notEmpty()

        let errors = req.validationErrors()
        if (errors) {
            let array = []
            for (let item of errors) {
                array.push(item.msg)
            }
            return res.json({ mssg: array })
        } else {

            upload(req, res, function (err) {
                if (err) {
                    console.log(err);
                }

                P.coroutine(function* () {
                    try {
                        let acceptRequest = yield db.query('UPDATE `user_details` SET `vdoc` = ? WHERE `user_id` = ?', [req.file.filename, data.user])
                    } catch (err) {
                        console.log(err)
                    }

                })()
                return res.json({ mssg: 'File uploaded successfully.', success: "true" });
            })
        }
    })

});

app.post('/challenge', (req, res) => {
    db.registerChallenge(req.body, res)
})

app.use("/profile_image_update", upload)

app.post("/profile_image_update", ensureToken, function (req, res) {

    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {

        if (err) {
            generateError(res, 'Error authenticating user!');
        }
        req.checkBody('user_id', 'User id is empty').notEmpty()

        let errors = req.validationErrors()
        if (errors) {
            let array = []
            for (let item of errors) {
                array.push(item.msg)
            }
            return res.json({ mssg: array })
        } else {

            upload(req, res, function (err) {
                if (err) {
                    console.log(err);
                }
                P.coroutine(function* () {
                    let acceptRequest = yield db.query('UPDATE `user_details` SET `profile_pic` = ? WHERE `user_id` = ?', [req.file.filename, data.user])
                })()
                return res.json({ mssg: 'File uploaded successfully.', success: true });
            })
        } //end else condition
    })

})

app.post("/creditUpdate", ensureToken, function (req, res) {
    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {
        let { body: { user_id, action, credits } } = req

        req.checkBody("user_id", "User_id should not be empty").notEmpty()
        req.checkBody("action", "Invalid action").isIn(['add', 'deduct'])
        req.checkBody("credits", "Credits must be numeric").isNumeric()
        let errors = req.validationErrors()
        if (errors) {
            let array = []
            for (let item of errors) {
                array.push(item.msg)
            }
            generateError(res, array)
        } else {
            if (err) {
                generateError(res, 'Error authenticating user!');
                return
            }
            db.creditUpdate(user_id, action, credits, res)
                .then(_ => {
                    res.json({ mssg: "Credits updated sucessfully" })
                }).catch(err => {
                    generateError(res, "Error in updating credits")
                })
        }
    })
})

app.post("/updateStatus", ensureToken, (req, res) => {
    jwt.verify(req.token, process.env.SECRET_KEY, function (err, data) {
        let { body: { user_id, status } } = req
        req.checkBody("status", "Status accepts only y | n values").isIn(['y', 'n']).notEmpty

        let errors = req.validationErrors()
        if (errors) {
            let array = []
            for (let item of errors) {
                array.push(item.msg)
            }
            generateError(res, array)
        } else {
            try {
                db.updateActivity(status, data.user)
                res.json({ status: true })
            } catch (err) {
                generateError(res, "Online status could not be set")
            }
        }
    })
})

app.post("/verificationStatus", ensureToken, (req, res) => {
    jwt.verify(req.token, process.env.SECRET_KEY, async function (err, data) {
        let { body: { user_id } } = req
        req.checkBody("user_id", "User_id should not be empty").notEmpty()
        let errors = req.validationErrors()
        if (errors) {
            let array = []
            for (let item of errors) {
                array.push(item.msg)
            }
            generateError(res, array)
        } else {
            try {
                let status = await db.getVerificationStatus(user_id)
                if (status.length) {
                    res.json({ verification_status: status[0].verification_status })
                } else {
                    generateError(res, "No data found")
                }

            } catch (err) {
                generateError(res, "Error retrieving data")
            }
        }
    })
})


app.get('/pay/:unqid/:amount', function (req, res) {
    let { params: { unqid, amount }, query: { currency, product } } = req
    _login.getUserId(unqid)
        .then(function (user) {
            // req.session.id = user.id
            db.query(`SELECT u.id,u.email,ud.phone FROM users u inner join user_details ud on u.id=ud.user_id where u.unqid= ?`, [unqid])
                .then(data => {
                    data[0].amount = amount
                    data[0].product = product
                    res.render("user/pay", { data: data[0], currency_format: currency ? currency : 'USD' })
                })
        })

})

var oauth2 = new OAuth2(
    configAuth.facebookAuth.clientID,
    configAuth.facebookAuth.clientSecret,
    "https://www.facebook.com/dialog/oauth",
    "https://graph.facebook.com/oauth/access_token",
    null);

app.get("/auth/verifyprofile", function (req, res) {
    //console.log(req.query);
    //console.log(req.params);
    oauth2.get("https://graph.facebook.com/me?fields=id,name,email", req.query.accessToken, async (err, data, response) => {
        if (err) {
            console.error(err);
            generateError(res, "Please login to facebook again")
        } else {
            //console.log('req.query.push_id'+req.query.push_id);
            var profile = JSON.parse(data);
            //console.log('req.query.push_id:'+req.query.push_id);
            //console.log('profile::');
            //console.log(profile);
            let userExistence = await db.query(`select count(id) as count from users where email='${profile.email}'`)
            if (userExistence[0].count != 0) {
                req.body.exist = 1
                req.body.email = profile.email
                req.body.push_id = req.query.push_id
                _login.login(req, res)
            } else {
                generateError(res, "User doesn't exists")
            }

        }
    });
});


app.post("/updateGameStat", async (req, res) => {
    let { body: { user_id, game_id, outcome, coins } } = req

    console.log(req.body)
    let statExists = await db.query("SELECT * FROM player_statistics where user_id= ? and game_id = ?", [user_id, game_id])
    let prevStats = statExists[0]
    updateStats2(req)
    let action = "update"
    const construct = {}
    if (!statExists.length) {
        action = 'insert'
    }
    construct.total_battles = action == "update" ? prevStats.total_battles + 1 : 1
    if (outcome == 'won') {
        construct.battles_won = action == "update" ? prevStats.battles_won + 1 : 1
        construct.coins_won = action == "update" ? prevStats.coins_won + Number(coins) : Number(coins)
    } else if (outcome == 'lost') {
        construct.battles_lost = action == "update" ? prevStats.battles_lost + 1 : 1
        construct.coins_lost = action == "update" ? prevStats.coins_lost + Number(coins) : Number(coins)
    }
    try {
        if (action == "update") {
            db.query("UPDATE player_statistics SET ? where user_id= ? and game_id = ?", [construct, user_id, game_id])
        } else {
            construct.user_id = user_id
            construct.game_id = game_id
            db.query("INSERT INTO player_statistics SET ?", [construct])
        }
        res.json(construct)
    } catch (err) { res.json({ error: "Error in updating statistics" }) }
})

function updateStats2(req) {
    let { body: { user_id, game_id, outcome, coins } } = req
    db.query("SELECT id FROM tournament where CURRENT_DATE() BETWEEN start_date and end_date").then(res => {
        if (res[0]) {
            let construct = {
                'user_id': user_id,
                'game_id': game_id,
                'outcome': outcome,
                'tournament_id': res[0].id
            }
            outcome == "won" ? construct.coins_won = coins : construct.coins_lost = coins
            try {
                db.query("INSERT INTO player_statistics_mod SET ?", construct)
            } catch (err) {
                console.log(err)
            }
        }
    })
}

app.post("/convertCurrency", async (req, res) => {
    // currencies is the token amount that needs to be converted to currency
    let { body: { currencies, user_id, currency_type, type }, session } = req
    let newBuild = {}
    user_id = session.id ? session.id : user_id

    if (type == 'sale') {
        request.get(`http://apilayer.net/api/live?access_key=${process.env.CONVERT_CURENCY_KEY}&source = GBP&currencies=USD,NGN&format=1`, (error, response, body) => {
            let ngn = currency_type == 'NGN' ? 100 : 100 / JSON.parse(body).quotes.USDNGN
            let currency = (currencies * ngn).toFixed(2)
            res.json({ currency: currency, currency_format: currency_type == 'NGN' ? 'NGN' : 'USD' })
        })
    } else if (type == 'buy') {
        let currency
        request.get(`http://apilayer.net/api/live?access_key=${process.env.CONVERT_CURENCY_KEY}&source = GBP&currencies=USD,NGN&format=1`, (error, response, body) => {
            let ngn = currency_type != 'NGN' ? JSON.parse(body).quotes.USDNGN : 1
            if (currency_type == "USD") {
                currency = (currencies / ngn).toFixed(2)
            } else {
                currency = currencies
            }
            res.json({ currency: currency, currency_format: currency_type == 'NGN' ? 'NGN' : 'USD' })
        })
    } else {
        let country = await db.query(`SELECT country FROM user_details WHERE user_id = ${user_id}`)
        country = country[0].country.toLowerCase()
        request.get(`http://apilayer.net/api/live?access_key=${process.env.CONVERT_CURENCY_KEY}&source = GBP&currencies=USD,NGN&format=1`, (error, response, body) => {
            let ngn = country != 'nigeria' ? JSON.parse(body).quotes.USDNGN : 1
            if (country != "nigeria") {
                for (const key in currencies) {
                    newBuild[key] = (currencies[key] / ngn).toFixed(2)
                }
            } else {
                Object.assign(newBuild, currencies)
            }
            res.json({ currency: newBuild, currency_format: country == 'nigeria' ? 'NGN' : 'USD' })
        })
    }
})

app.post("/gettoken", (req, res) => {
    let session = req.body.session
    var token = jwt.sign({ user: session }, process.env.SECRET_KEY);
    res.json({ token: token, user_id: session })
})

app.post("/playerstats", ensureToken, async (req, res) => {
    jwt.verify(req.token, process.env.SECRET_KEY, async function (err, data) {
        let user = data.user
        db.query(`Select ps.*,g.* from player_statistics ps inner join games g on ps.game_id=g.id where ps.user_id=${user}`, function (err, rows, fields) {
            let stats = rows
            db.query(`SELECT g.game_name from favorite_games fg inner join games g on g.id=fg.game_id where user_id = ${user}`, (err, rows, fields) => {
                res.json({ stats: stats, fav: rows[0] && rows[0].hasOwnProperty('game_name') ? rows[0].game_name : '' })
            })
        })
    })
})

app.post("/users/credit/update", async (req, res) => {
    let { body: { user_id, credit } } = req
    if(credit < 0){
        credit = 0
    }
    try {
        db.query(`UPDATE user_details SET credit_balance = ? WHERE user_id= ?`, [credit, user_id])
        res.json({ status: true })
    } catch (err) { res.json({ status: false }) }
})

app.get("/tournament", async (req, res) => {
    try {
        let tounament = await db.query("SELECT * FROM tournament where CURRENT_DATE() BETWEEN start_date and end_date")
        let image = tounament[0].image
        res.json({ tournament_image: image })
    } catch (err) {
        res.json({ tournament_image: null })
        console.log(err)
    }
})

app.get("/notifications", async (req, res) => {
    try {
        let notification = await db.query(`SELECT * FROM notification where type='normal' order by created_at DESC`)
        notification.map((notif, i) => notification[i].text = JSON.parse(notif.text))
        res.json({ data: notification })
    } catch (err) {
        console.log(err)
        generateError(res, "Some error occurred")
    }
})

app.post("/notification-app", async (req, res) => {
    let { body: { message, subject  } } = req

    try {
       db.query(`SELECT push_id FROM user_details where push_id IS NOT NULL AND push_id <>''`)
         .then(users => {
             finalArray = users.map(function (obj) {
                      return obj.push_id;
                    });
             return db.sendMessage(finalArray, 'Hello Test!');
             
           })
         .then(response => {
             res.json({ response }) 
           }) 
          
    } catch (err) {
        console.log(err)
        generateError(res, "Some error occurred")
    }
})

function spamFilter(rows) {
    rows.map(msg => {
        let message = msg.message;
        spamlist.wordlist.forEach(word => {
            if (message.includes(word) || new RegExp(word, "gi").test(message)) {
                message = message.replace(new RegExp(`\\b${word}\\b`, "gi"), "*****");
            }
        });
        return msg.message = message;
    });
    return rows
}

app.get("/firebase/:from/:to/:gameid", async (req, res) => {
    let { to, from, gameid } = req.params
    let token = await db.query(`SELECT notification_token from users where unqid = ? or id =? `, [to, to])
    let gamename = await db.query(`SELECT game_desc from games where id = ${gameid}`)
    gamename = gamename[0].game_desc
    var registrationToken = token[0].notification_token;
    var payload = {
        notification: {
            title: 'Oneup',
            body: 'Welcome to Oneup.ng. Play games like never before',
            click_action: `https://oneup.ng/game-play/${gamename}`
        }
    };
    admin.messaging().sendToDevice(registrationToken, payload)
        .then(function (response) {
            res.json({ status: 200, message: "Push notification sent successfully" })
        })
        .catch(function (error) {
            console.log('Error sending message:', error);
            res.json({ status: 203, message: "Unable to send Push notification" })
        });
})
module.exports = app
