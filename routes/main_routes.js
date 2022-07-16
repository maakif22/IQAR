const
    app = require('express').Router(),
    db = require('../models/db'),
    hl = require('handy-log'),
    mw = require('../models/middlewares')

app.get('/', async (req, res) => {
    let options = { title: "One Up" }
    let farr = []
    
    res.render('user/home', { options, fav: farr })
})

app.get('/edit', mw.LoggedIn, (req, res) => {
    let options = { title: "Edit profile" }
    res.render('user/edit', { options, layout: false })
})
// static pages start

app.get('/privacy-policy', (req, res) => {

    let row = db.page('privacy-policy');
    row.then((data) => {
        let page = JSON.parse(JSON.stringify(data[0]));
        res.render('pages/privacypolicy', { page: page })
    });
})

app.get('/faq', (req, res) => {
    let row = db.page('faq');
    row.then((data) => {
        let page = JSON.parse(JSON.stringify(data[0]));
        res.render('pages/faq', { page: page })
    });
})
app.get('/terms', (req, res) => {

    let row = db.page('terms');
    row.then((data) => {
        let page = JSON.parse(JSON.stringify(data[0]));
        res.render('pages/terms', { page: page })
    });
})

app.get('/game-rules', (req, res) => {

    let row = db.page('game-rules');
    row.then((data) => {
        let page = JSON.parse(JSON.stringify(data[0]));
        res.render('pages/gamerules', { page: page })
    });
})

app.get('/responsible-gaming', (req, res) => {

    let row = db.page('responsible-gaming');
    row.then((data) => {
        let page = JSON.parse(JSON.stringify(data[0]));
        res.render('pages/responsible-gaming', { page: page })
    });
})

app.get('/about-iqar', (req, res) => {

    let row = db.page('about-iqar');
    row.then((data) => {
        let page = JSON.parse(JSON.stringify(data[0]));
        res.render('pages/about-iqar', { page: page })
    });
})
//static pages end

app.get('/search', function (req, res) {
    db.query('SELECT id, email, firstname from users where firstname like "%' + req.query.key + '%"and isadmin!=1 and id !=' + req.session.id, function (err, rows, fields) {
        if (err) throw err;
        var data = [];
        for (i = 0; i < rows.length; i++) {
            data.push(rows[i].firstname);
        }
        res.end(JSON.stringify(data));
    });
});

app.get('/error', (req, res) => {
    let options = { title: "Oops!" }
    res.render('user/error', options)
})

app.get("/commingsoon", (req, res) => {
    res.render("user/comming-soon")
})
module.exports = app
