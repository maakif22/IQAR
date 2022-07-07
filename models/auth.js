module.exports = {

    'facebookAuth': {
        'clientID': '1726323354144062', // your App ID
        'clientSecret': '9140bdac0cdf2864ec71a97ab979bb43', // your App Secret
        // 'callbackURL'   : 'http://localhost:4000/auth/facebook/callback',
        'callbackURL': 'https://www.oneup.ng/auth/facebook/callback',
        // 'profileURL'    : 'https://graph.facebook.com/v2.5/me?fields=first_name,last_name,email',
        //'profileFields' : ['id', 'email', 'name'] // For requesting permissions from Facebook API
    },
    'payPal': {
        'mode': 'sandbox', //sandbox or live 
        'client_id': 'ATeJGi0Tkt9k4n06TMluXPdSjPuAIHmnMuXxMRnxfYempBkfssa7fzwdHPsa2RbdSDEedoJKkJ09K9O5', // please provide your client id here 
        'client_secret': 'EJ32V1GRsw681xrSyMvlYaBbeIUNsapHWu_7Pg0zjSG2mLc04-uwhTPdiA099Zct1Lh7eBbfGB6RAa3a' // provide your client secret here 
    },
};