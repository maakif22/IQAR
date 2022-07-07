require('dotenv').config()

// modules
var
    express = require('express'),
    port = process.env.PORT,
    path = require('path'),
    favicon = require('serve-favicon'),
    bodyParser = require('body-parser'),
    validator = require('express-validator'),
    session = require('client-sessions'),
    hl = require('handy-log'),
    nodeadmin = require('nodeadmin'),
    passport = require('passport'),
    engine = require('ejs-mate'),
    app = express(),
    methodOverride = require('method-override'),
    cookieParser = require('cookie-parser'),
    compression = require("compression"),
    admin = require('firebase-admin'),
    helmet = require("helmet"),
    compression = require('compression');
let cors = require("cors");

app.use(compression());
// app.use(helmet.contentSecurityPolicy({
//     directives: {
//         defaultSrc: ["'self'"],
//         styleSrc: ["'self'", 'oneup.ng']
//     }
// }))
app.engine('ejs', engine);
app.set('views', __dirname + '/views');
app.use(cors())
app.use(compression())
// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  In a
// production-quality application, this would typically be as simple as
// supplying the user ID when serializing, and querying the user record by ID
// from the database when deserializing.  However, due to the fact that this
// example does not have a database, the complete Facebook profile is serialized
// and deserialized.



// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());

// app.enable('trust proxy');

app.set('trust proxy', function (ip) {
    if (ip === '::ffff:52.14.59.22' || ip === '52.14.59.22') return true // trusted IPs
    else return false
})
// set the view engine to ejs
app.use(function (req, res, next) {
    switch (req.path) {
        case '/signup':
            res.locals.curr = 'hide';
            break;
        case '/login':
            res.locals.curr = 'hide';
            break;
        default:
            res.locals.curr = 'show';
    }
    next();
});

app.set('view engine', 'ejs');

// file modules
var
    mainR = require('./routes/main_routes'),
    userR = require('./routes/user_routes'),
    apiR = require('./routes/api_routes'),
    apiS = require('./routes/apis'),
    msg = require('./routes/message_routes'),
    admN = require('./routes/control_panel'),
    mw = require('./models/middlewares');

// middlewares
app.use(favicon(path.join(__dirname, "/public/images/favicon/favicon.ico")))
app.use(express.static(path.join(__dirname, "/public")))

app.use(bodyParser.json({ limit: '50mb', extended: true }))
    .use(bodyParser.urlencoded({ limit: '50mb', extended: true }))


app.use(validator())

app.use(cookieParser());

//Session
app.use(session({
    cookieName: "session",
    secret: process.env.SESSION_SECRET_LETTER,
    duration: 30 * 60 * 1000,
    activeDuration: 10 * 60 * 1000
}))

//Flash Messages
app.use(require('connect-flash')());
app.use(function (req, res, next) {
    res.locals.messages = require('express-messages')(req, res);
    next();
});


app.use(methodOverride(function (req, res) {
    if (req.body && typeof req.body == 'object' && '_method' in req.body) {
        var method = req.body._method;
        delete req.body._method;
        return method;
    }
}));
// Add headers
app.use(function (req, res, next) {

    //     // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    //     // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE,OPTIONS');

    //     // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    //     // Set to true if you need the website to include cookies in the requests sent
    //     // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    res.setHeader('Upgrade-Insecure-Requests', 1)
    //     // Pass to next layer of middleware
    next();
});

// Middleware for some local variables to be used in templates
app.use(mw.variables)

app.use(nodeadmin(app));
// Routes middlewares

app.use('/', mainR);
app.use('/', userR);
app.use('/api', apiR);
app.use('/apis', apiS);
app.use('/controlpanel', admN);


// Middleware for 404 page
app.use(mw.not_found)

var serviceAccount = require('./models/firebase.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://oneup-e1adc.firebaseio.com"
});

var server = app.listen(port, () => hl.rainbow('App running..on post:' + port))
