const nodemailer = require('nodemailer')
const fs = require("fs")

var transport = nodemailer.createTransport({
    host: 'parrot.whogohost.com',
    port: 465,
    auth: {
        user: 'contact@oneup.ng',
        pass: 'Murphy@08033978357'
    }
});

transport.verify(function (error, success) {
    if (error) {
        console.log(error);
    } else {
        console.log('Server is ready to take our messages');
    }
});

let mail = (options, renderable) => {
    return new Promise(async (resolve, reject) => {
        let html = await renderTemplate(renderable)
        options.html = html
        let o = Object.assign({ from: process.env.FROM }, options)
        transport.sendMail(o, (err, res) => {
            console.log(res)
            err ? reject(err) : resolve('Mail sent!!')
        })
    })
}

const renderTemplate = (options) => {
    let template_path = options.template
    let content = options.locals
    let html = new Promise((resolve, reject) => {
        fs.readFile(template_path, (err, data) => {
            if (err) reject(err)
            data = String(data)
            for (toReplace in content) {
                data = data.replace(new RegExp("{{" + toReplace + "}}", "g"), content[toReplace])
            }
            resolve(data)
        })
    })
    return html
}
module.exports = mail