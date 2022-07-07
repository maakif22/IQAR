const db = require("./db"),
    nodecron = require("node-cron");

(() => {
    nodecron.schedule('1 */24 * * *', () => {
        console.log("cron started")
        try {
            db.query(`DELETE from inbox where DATEDIFF(CURRENT_DATE(),created_on) >=90`)
            db.query(`DELETE FROM notification where DATEDIFF(CURRENT_DATE(),created_at) >1`)
        } catch (err) {
            console.log(err)
        }
    })
})()
