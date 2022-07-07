const
    app = require('express').Router(),
    db = require('../models/db'),
    mw = require('../models/middlewares');

app.get('/', mw.LoggedIn, (req, res) => {
    return res.redirect('/message/inbox');
})

app.get('/inbox', mw.LoggedIn, (req, res) => {
    db.inbox(req, res, 'user/inbox');
})

app.get('/sent', mw.LoggedIn, (req, res) => {
    db.outbox(req, res, 'user/sentMessages');

})

app.get('/compose', mw.LoggedIn, (req, res) => {

    res.render('user/compose')
})

app.get('/readmessage/:id', mw.LoggedIn, (req, res) => {
    db.readMessage(req, res, 'user/readMessage')
})

app.get('/readsentmessage/:id', mw.LoggedIn, (req, res) => {
    db.query('SELECT inbox.*, users.email, users.firstname FROM `inbox` join users on inbox.to_id = users.id where inbox.id = ' + req.params.id + '', function (err, rows, fields) {
        if (err) throw err;

        res.render('user/readMessage', { message: rows[0] })
    });
})

module.exports = app
