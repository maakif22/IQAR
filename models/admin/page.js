const
    db = require('../db'),
    hl = require('handy-log'),
    P = require('bluebird'),
    fs = require('fs'),
    path = require('path'),
    dir = process.cwd()



const pageList = (req, res) => {
    P.coroutine(function* (){
            let rows = yield db.query('Select * from pages');
            //console.log(rows[0].joined);
            if(rows.length == 0){
                res.json({ mssg: "No Page found!" });
            } else if(rows.length > 0) {
                res.render("admin/pages", {pages:rows} );
            }
    })()
}

const singlePage = (req, res, page_id) => {
    P.coroutine(function* (){
            let row = yield db.query('Select * from pages WHERE id='+page_id);
            //console.log(rows[0].joined);
            if(row.length == 0){
                res.json({ mssg: "No page found!" });
            } else if(row.length > 0) {
                res.render("admin/single", {page:row[0]} );
            }
    })()
}

const savePage = (req, res) => {

    let { body: { id, page_title, slug, page_content, status } } = req

    console.log(id);console.log(page_title);console.log(slug);console.log();console.log();
    //req.checkBody('firstname', 'First Name is empty').notEmpty()
    req.checkBody('slug', 'Slug is empty').notEmpty()

    let errors = req.validationErrors();
    if(errors){
        let array = []
        for(let item of errors) {
            array.push(item.msg)
        }
        res.json({ mssg: array })
    } else {

        db.query('SELECT COUNT(*) as slugCount from pages WHERE slug = ?', [slug])
            .then(result => {
                if(result[0].slugCount == 1 && id ==''){
                   return res.json({ mssg: "Slug already exists! Please select another slug" })
                } else if(result[0].slugCount == 1 && id !=''){
                    
                    let updatePage = [
                        page_title,
                        slug,
                        page_content,
                        status,
                        id
                    ];
                 db.query('UPDATE `pages` SET page_title = ?, slug = ?, page_content = ?, status = ?  WHERE id =?', updatePage);

                } else if(result[0].slugCount < 1 && id !=''){

                    let newPage = {
                        page_title,
                        slug,
                        page_content,
                        status
                    }

                    db.query('INSERT INTO pages SET ?', Object.assign({}, newPage ))
                }
                req.flash('success', 'Saved');
               return res.redirect('pages')
            })
            .catch(err => console.log(hl.error(err)) )
    }
}

module.exports = {
    pageList,
    singlePage,
    savePage
}
