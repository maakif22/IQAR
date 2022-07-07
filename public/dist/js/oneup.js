/**
* Add friend requet
* argument anchor as this object 
*/
// $(document).ready(function () {
function addFriend(argument) {
  let userId = argument.getAttribute('data-userId');
  console.log(userId);

  $.ajax({
    url: "/api/addfriend",
    method: "POST",
    data: { "user": userId },
    dataType: "JSON",
    success: data => {
      argument.innerHTML = 'Cancel Request';
      argument.setAttribute('onclick', 'cancelRequest(this)');
    }
  })
}


/**
* Cancel friend request
*/
function cancelRequest(argument) {
  let userId = argument.getAttribute('data-userId');
  console.log(userId);

  $.ajax({
    url: "/api/cancelRequest",
    method: "POST",
    data: { "user": userId },
    dataType: "JSON",
    success: data => {
      argument.innerHTML = 'Add Friend';
      argument.setAttribute('onclick', 'addFriend(this)');
    }
  })
}


/**
* Delete message
*/

function deletemessage(argument) {
  let mId = argument.getAttribute('data-mId');
  let Area = argument.getAttribute('data-area');
  $.ajax({
    url: "/api/delmsg",
    method: "POST",
    data: { "mid": mId, "area": Area },
    dataType: "JSON",
    success: data => {
      $.notify("Message Deleted", "success");
      if (Area) {
        location.reload();
      } else {
        location = '/message/inbox'
      }

    }
  })
}
/**
* To unfriend user
*/
function unfriend(argument) {
  let userId = argument.getAttribute('data-userId');
  console.log(userId);

  $.ajax({
    url: "/api/unfriend",
    method: "POST",
    data: { "user": userId },
    dataType: "JSON",
    success: data => {
      argument.innerHTML = 'Add Friend';
      argument.setAttribute('onclick', 'addFriend(this)');
    }
  })
}

/**
* Accept friend requet
* argument anchor as this object 
*/
function acceptRequest(argument) {
  let userId = argument.getAttribute('data-userId');
  console.log(userId);

  $.ajax({
    url: "/api/acceptRequest",
    method: "POST",
    data: { "user": userId },
    dataType: "JSON",
    success: data => {
      argument.innerHTML = 'Unfriend';
      argument.setAttribute('onclick', 'unfriend(this)');
      $(argument).next().remove();
    }
  })
}

/**
* Decline friend request
*/
function declineRequest(argument) {
  let userId = argument.getAttribute('data-userId');
  console.log(userId);

  $.ajax({
    url: "/api/declineRequest",
    method: "POST",
    data: { "user": userId },
    dataType: "JSON",
    success: data => {
      argument.innerHTML = 'Add Friend';
      argument.setAttribute('onclick', 'addFriend(this)');
      $(argument).prev().remove();

    }
  })
}

/**
* Block user
*/
function blockUser(argument) {
  let userId = argument.getAttribute('data-userId');
  // console.log(userId);

  $.ajax({
    url: "/api/blockUser",
    method: "POST",
    data: { "user": userId },
    dataType: "JSON",
    success: data => {
      argument.innerHTML = 'Unblock';
      argument.setAttribute('onclick', 'unblockUser(this)');
    }
  })
}

/**
* un-Block user
*/
function unblockUser(argument) {
  let userId = argument.getAttribute('data-userId');
  console.log(userId);

  $.ajax({
    url: "/api/unblockUser",
    method: "POST",
    data: { "user": userId },
    dataType: "JSON",
    success: data => {
      argument.innerHTML = 'Block';
      argument.setAttribute('onclick', 'blockUser(this)');
    }
  })
}

/**
*For sending message
*/
function sendMessage(e) {

  console.log($("#to_id").val());
  var data = {};
  data.to_id = $("#to_id").val();
  data.subject = $("#subject").val();
  data.message = $("#message").val();
  let error = 0
  if (data.to_id == "" || data.to_id == null || data.to_id == undefined) {
    $.notify("Reciever has not been specified or doesn't exist", "error");
    error = 1
  }
  if (data.subject == "") {
    $.notify("Subject cannot be blank", "error");
    error = 1
  }
  if (data.message == "" || data.message.length > 350) {
    $.notify("Message cannot be left blank and it must be less that 350 characters", "error");
    error = 1
  }
  console.log(data);
  if (error) {
    return
  }


  $.ajax({
    url: "/api/sendMessage",
    method: "POST",
    data: data,
    dataType: "JSON",
    success: data => {
      $.notify("Message Sent", "success");
      $("#to_id,#friends_autocomplete").val("");
      $("#subject").val("");
      $("#message").val("");
    }
  })
}

$(document).ready(function () {
  $('input.typeahead').typeahead({
    name: 'users',
    remote: '/search?key=%QUERY',
    limit: 10,

  });

  $('input.typeahead').on(
    {
      'typeahead:selected': function (e, datum) {
        console.log(datum);
        console.log('selected');
        window.location.href = '/findfriend/?key=' + datum.value
      },
    });
});

/**
*Autocomplete friends search in inbox
*/
/**/
$("#friends_autocomplete").autocomplete({
  source: function (request, response) {
    $.ajax({
      url: "/api/friends1",
      data: {
        "friend_name": request.term
      },
      type: "GET",
      success: function (resp) {
        resp = JSON.parse(resp);
        response($.map(resp, function (item) {
          return {
            name: item.id,
            value: item.firstname
          }
        }));
      }
    })
  },
  select: function (event, ui) {
    $("#to_id").val(ui.item.name);
    return true;
  }
});
/**
*For edit profile 
*
*/
$(function () {
  $('#edit-profile-btn').click(function (e) {
    e.preventDefault();
    var id = $("#userId").val();
    // console.log(id)
    // return false;
    var data = {};
    data.firstname = $("#firstname").val();
    data.lastname = $("#lastname").val();
    data.email = $("#email").val();
    data.age = $("#age").val();
    data.phone = $("#phone").val();
    data.state = $("#state :selected").text();
    data.country = $("#country :selected").text()
    data.res_address = $("#res_address").val();
    let error = 0

    if (!new RegExp("[a-z]").test(data.firstname)) {
      $.notify("Firstname's format is invalid", "error");
      error = 1
    }

    if (!new RegExp("[a-z]").test(data.lastname)) {
      $.notify("Lastname's format is invalid", "error");
      error = 1
    }

    if (data.age.length > 3 || data.age < 16) {
      $.notify("Age is invalid", "error");
      error = 1
    }

    if (data.phone.length > 15) {
      $.notify("Phone number is invalid", "error");
      error = 1
    }

    if (data.res_address.length > 350) {
      $.notify("Address too long", "error");
      error = 1
    }

    if (error) {
      return
    }

    $.ajax({
      type: 'POST',
      data: JSON.stringify(data),
      contentType: 'application/json',
      url: '/api/editmyprofile',
      success: function (data) {
        console.log('success');
        console.log(JSON.stringify(data));
        if (data.success == true) {
          $.notify("Updated Successfully!!", "success");
          window.location.replace("/myprofile/" + id);

        } else {
          $.notify(data.mssg, "error");
        }
      },
      error: function () {
        console.log('error');
      }
    });
  });
});


/**
  *For deleting message
  *
  */
$(function () {
  $('#delmsg').click(function (e) {
    e.preventDefault();
    var ids = $("input[name=msgdel]").val();
    //var id = $("#userId").val();
    //var data = {};

    //data.bank_name = $("#bank_name").val();
    //data.bank_acc_no = $("#bank_acc_no").val();
    //data.bank_acc_name = $("#bank_acc_name").val();
    //data.bank_code = $("#bank_code").val();
    $.ajax({
      type: 'POST',
      data: JSON.stringify(data),
      contentType: 'application/json',
      url: '/api/updatebankdetails',
      success: function (data) {
        console.log('success');
        //console.log(JSON.stringify(data));
        if (data.success == true) {
          $.notify("Updated Successfully!!", "success");
          window.location.replace("/myprofile/" + id);

        } else {
          $.notify(data.mssg, "error");
        }
      },
      error: function () {
        console.log('error');
      }
    });
  });
});

/**
*For Uploading verifcation Doc
*
*/


$(function () {

  $('#add-doc-btn').click(function (e) {
    e.preventDefault();
    var file = $("#add_doc")[0].files[0];
    var boundary = "xxxxxxxxxx";
    if (file == undefined) {
      //alert('no file selected.');
      $.notify("Please select file", "error");
      return false;
    }

    var formData = new FormData();
    formData.append('add_doc', file);

    $.ajax({
      type: 'POST',
      data: formData,
      contentType: false,
      //headers: {"Content-Type": "multipart/form-data; boundary=" + boundary},
      processData: false,
      cache: false,
      url: '/api/upload_doc',
      success: function (data) {
        //console.log('success');
        //console.log(JSON.stringify(data));
        if (data.success == true) {
          $.notify("Your document has been uploaded Successfully!!. Administrator will review and update the verifcation status", "success");
          $('#add-doc-form').get(0).reset();
          //window.location.replace("/myprofile/"+id);

        } else {
          $.notify(data.mssg, "error");
        }
      },
      error: function () {
        console.log('error');
      }
    });
  });
});

/*   uploadBtn.click(function (event) {
 var formData = new FormData();
 formData.append('photo', $('#inputFile').get(0).files[0]);
 var request = $.ajax({
   url: "/upload",
   method: "POST",
   data: formData,
   contentType: false,
   processData: false,
   cache: false
 }).done(function(data){
   uploadBtn.text("Uploaded");
 });
});*/

/**
*For edit Bank details 
*
*/
$(function () {
  $('#accinfo').click(function (e) {
    e.preventDefault();
    var id = $("#userId").val();
    var data = {};

    data.bank_name = $("#bank_name :selected").val();
    data.bank_acc_no = $("#bank_acc_no").val();
    data.bank_acc_name = $("#bank_acc_name").val();
    // data.bank_code = $("#bank_code").val();
    if (data.bank_acc_no.length > 20) {
      e.preventDefault()
      $.notify("Maximum range for account number is 20")
      return
    }

    if (data.bank_name == '' || data.bank_acc_name == '' || data.bank_acc_no == '') {
      $.notify('Fields cannot be null', "error");
      return
    }
    $.ajax({
      type: 'POST',
      data: JSON.stringify(data),
      contentType: 'application/json',
      url: '/api/editbankdetails',
      success: function (data) {
        if (data.success == true) {
          $.notify("Updated Successfully!!", "success");
          setTimeout(() => {
            location = "/"
          }, 2000)
        } else {
          $.notify(data.mssg, "error");
        }
      },
      error: function () {
        console.log('error');
      }
    });
  });
});
/**
*
*For change password 
*/
$(function () {
  $('#change-password-btn').click(function (e) {
    e.preventDefault();
    var data = {};
    data.oldPass = $("#old-password").val();
    data.password = $("#new-password").val();
    data.confirmPassword = $("#confirm-password").val();

    if (data.oldPass == '') {
      $.notify("Old Password can't be empty", "error");
      return false
    } else if (data.password == '') {
      $.notify("password can't be empty", "error");
      return false
    } else if (data.confirmPassword == '') {
      $.notify("Confirm password can't be empty", "error");
      return false
    } if (!new RegExp("^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])").test(data.password)) {
      $.notify("The password must contain an Uppercase character and a Number", "error");
      return false
    } else if (data.password != data.confirmPassword) {
      $.notify("password doesn't match", "error");
      return false
    }
    $.ajax({
      type: 'POST',
      data: JSON.stringify(data),
      contentType: 'application/json',
      url: '/api/changepassword',
      success: function (data) {
        if (data.success == true) {
          $.notify("Updated Successfully!!", "success");

          setTimeout(function () {
            window.location.replace("/myprofile/" + data.uid);
          }, 3000);


        } else {
          $.notify(data.mssg, "error");
        }
      },
      error: function () {
        console.log('error');
      }
    });
  });
});

/**
*
*For change password 
*/
$(function () {
  $('#update-password-btn').click(function (e) {
    e.preventDefault();
    var data = {};
    data.password = $("#new-password").val();
    data.confirmPassword = $("#confirm-password").val();
    data.email = $("#email").val();

    if (data.password == '') {
      $.notify("password can't be empty", "error");
      return false
    } else if (data.confirmPassword == '') {
      $.notify("Confirm password can't be empty", "error");
      return false
    } else if (data.password != data.confirmPassword) {
      $.notify("password doesn't match", "error");
      return false
    }
    $.ajax({
      type: 'POST',
      data: JSON.stringify(data),
      contentType: 'application/json',
      url: '/api/updatepassword',
      success: function (data) {
        if (data.success == true) {
          $.notify("Updated Successfully!!", "success");
          setTimeout(function () {
            window.location.replace("/login");
          }, 2000);
        } else {
          $.notify(data.mssg, "error");
          window.location.replace("/forgot-password");
        }
      },
      error: function () {
        console.log('error');
      }
    });
  });
});


/**
*
*For Sale Token 
*/
$(function () {
  $('#saletoken').click(function (e) {
    e.preventDefault();
    var data = {};
    data.credits = $("#credits").val();
    data.currency = $("#currency").val();

    if (data.credits == '') {
      $.notify("credits field can't be empty", "error");
      return false
    } else if (data.currency == '') {
      $.notify("Currency can't be empty", "error");
      return false
    }

    $.ajax({
      type: 'POST',
      data: JSON.stringify(data),
      contentType: 'application/json',
      url: '/api/saletoken',
      success: function (data) {
        if (data.success == true) {
          $.notify("Redeem Request Sent Successfully!!", "success");
          setTimeout(function () {
            window.location.replace("/saletoken");
          }, 2000);
        } else {
          $.notify(data.mssg, "error");
          window.location.replace("/saletoken");
        }
      },
      error: function () {
        console.log('error');
      }
    });
  });
});

$(function () {
  $('#login').click(function (e) {
    e.preventDefault();
    var theForm = $(this);
    var formID = theForm.attr("id");
    var data = {};
    data.email = $('input[name="email"]').val()
    data.password = $('input[name="password"]').val();
    $.ajax({
      type: 'POST',
      data: JSON.stringify(data),
      contentType: 'application/json',
      url: '/user/login',
      success: function (data) {
        if (data.success == true) {
          $.notify("Access granted", "success");
          if (data.usertype == 1) {
            window.location.replace("/controlpanel/dashboard");
          } else {
            window.location.replace("/");
          }


        } else {
          $.notify(data.mssg, "error");
        }
      },
      error: function () {
        console.log('error');
      }
    });
  });
});

$(function () {
  $('#forgot').click(function (e) {
    e.preventDefault();
    var theForm = $(this);
    var formID = theForm.attr("id");
    var data = {};
    data.email = $('input[name="email"]').val().trim()

    if (data.email == '') {
      $.notify("Please Enter Valid Email", "error");
      return false;
    }

    $.ajax({
      type: 'POST',
      data: JSON.stringify(data),
      contentType: 'application/json',
      url: '/api/forgot',
      success: function (data) {
        $('input[name="email"]').val('');
        $('#forgot').attr("disabled", "disabled");
        $.notify("Please check your inbox for further instructions", "success");
      },
      error: function (error) {
        console.log(error)
        $.notify('There is something wrong', "error");
      }
    });
  });
});

$(function () {
  $('#contact-form').click(function (e) {
    e.preventDefault();
    var theForm = $(this);
    var formID = theForm.attr("id");
    var data = {};
    data.email = $('input[name="email"]').val()
    data.subject = $('input[name="subject"]').val();
    data.message = $('textarea[name="message"]').val();

    $.ajax({
      type: 'POST',
      data: JSON.stringify(data),
      contentType: 'application/json',
      url: '/user/contact-us',
      success: function (data) {
        if (data.success == true) {
          $.notify("You message has been sent Successfully", "success");
          $('input[name="email"]').val("")
          $('input[name="subject"]').val("");
          $('textarea[name="message"]').val("");
        } else {
          $.notify(data.mssg, "error");
        }
      },
      error: function () {
        console.log('error');
      }
    });
  });
});

$(function () {
  $('#signup').click(function (e) {
    e.preventDefault();
    $('#loading').show();

    var data = {};
    data.firstname = $("#firstname").val();
    data.lastname = $("#lastname").val();
    data.email = $("#email").val();
    data.phone = $("#phone").val();
    data.country = $("#country").val();
    data.state = $("#state").val();
    data.res_address = $("#res_address").val();
    data.gender = $("#gender").val();
    data.age = $("#age").val();
    data.password = $("#password").val();
    data.password_again = $("#password_again").val();

    if (!new RegExp("^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])").test(data.password)) {
      $.notify("The password must contain an Uppercase character and a Number", "error");
      return false
    }

    $.ajax({
      type: 'POST',
      data: JSON.stringify(data),
      contentType: 'application/json',
      url: '/user/signup',
      success: function (data) {
        if (data.success == true) {
          $.notify("Registered Successfully!!", "success");
          $('#loading').hide();
          window.location.replace("/");

        } else {

          $.notify(data.mssg, "error");
          $('#loading').hide();
        }
      },
      error: function () {
        console.log('error');
        $('#loading').hide();
      }
    });
  });
});

$(document).on('click', "#revealreply", function () {
  $('#replybtn,#send').toggleClass("visible");
})

$(document).on('click', "#send", function () {
  var message = $("#replybtn").val()
  var email = $("input[name=email]").val()
  var subject = $("input[name=subject]").val()
  var thread = $("input[name = thread]").val()
  var to = $("input[name = to]").val()
  var from = $("input[name =from]").val()

  $.ajax({
    type: 'POST',
    data: {
      message: message,
      email: email,
      subject: subject,
      thread: thread,
      to: to,
      from: from
    },
    url: '/api/postReply',
    success: function (data) {
      if (data && data.message) {
        var text = `<div class="box-body no-padding"><div class="mailbox-read-info"><h5>
        <div class="mailbox-read-message">
          ${data.message}
        </div>
        <!-- /.mailbox-read-message -->
      </div>`;

        $("#chatbox").append(text)
      } else {
        $.notify("Unable to Send message", "error")
      }
    }
  })
})

var counter = 1
$(document).on("click", ".accordion", function () {
  let length = $(`.panel-${counter}`).attr('data-length')
  $(`.panel-${counter}`).addClass("visible")
  counter++
  if (counter == length) {
    $('.close').addClass("visible")
    $('.accordion').css({ "display": "none" })
    counter = 1
  }
})

$(document).on("click", ".close", function () {
  $(".panel").removeClass("visible")
  $(".close").removeClass("visible")
  $(".accordion").css({ "display": "block" })
})
$(document).on('keyup', "#replybtn", function () {
  let message = $(this).val()
  if (message.length > 0) {
    $("#send").attr('disabled', false)
  } else {
    $("#send").attr('disabled', true)
  }
})

$(document).on("click", "#sendMessage", function () {
  sendMessage(this)
})
const followLink = (e) => {
  let link = $(e).attr("data-ref")
  let notid = $(e).attr("data-notid")
  let status = $(e).attr("data-status")
  if (status != 'read') {
    $.ajax({
      url: '/registerNotification',
      data: {
        notification_id: notid
      },
      type: "POST",
      success: function (response) {
        $(e).removeClass('unread')
        $(e).attr("data-status", 'read')
        $(e).children(".notificstatus").text("read")
        if (link != 'null') {
          window.location = link
        }

      }
    })
  } else {
    if (link != 'null') {
      window.location = link
    }
  }
}
$(document).on("keyup", "#message", function () {
  countChar(this)
})
function countChar(val) {
  var len = val.value.length;
  if (len >= 350) {
    val.value = val.value.substring(0, 350);
    $('#charNum').text('Text limit 350 chars');
    val.preventDefault()
  } else {
    $('#charNum').text(350 - len);
  }
};

$(document).on('click', '#buy', function (e) {
  let amount = $("#amount :selected").val()
  if (!amount) {
    e.preventDefault()
    $.notify("Choose a package", 'error')
    return
  }
  let unq = $(this).attr("data-unq")
  let newurl = $("#formpay").attr('action', `/buy/${unq}/${amount}`)
})

$(document).on('click', '#pay', function (e) {
  let amount = $("#amount :selected").val()
  if (!amount) {
    e.preventDefault()
    $.notify("Choose a package", 'error')
    return
  }
  let product = $("#amount :selected").attr("data-product")
  let unq = $(this).attr("data-unq")
  let newurl = $("#formpay").attr('action', `/apis/pay/${unq}/${amount}?product=${product}`)
})

function makefav(elem) {
  let game_id = $(elem).attr("data-id")
  $.ajax({
    url: "/makefavourite",
    data: {
      game_id: game_id
    },
    type: "POST",
    success: function (data) {
      if (data.success == 'removed') {
        $(elem).css({ 'background': 'rgba(70,130,180,1)' })
        $(elem).html('<i class="fa fa-star-o" aria-hidden="true"></i> Add to favourite')
        $.notify(data.mssg, "success");
      } else if (data.success) {
        $('.text').css({ 'background': 'rgba(70,130,180,1)' })
        $(elem).css({ 'background': 'tomato' })
        $('.text').html('<i class="fa fa-star-o" aria-hidden="true"></i> Add to favourite')
        $(elem).html('<i class="fa fa-star-o" aria-hidden="true"></i> Remove favourite')
        $.notify(data.mssg, "success");
      } else {
        $.notify(data.mssg, "error");
      }

    }
  })
}
document.onload = (function () {
  var hash = document.location.hash;
  if (hash) {
    $('.nav-tabs a[href="' + hash + '"]').tab('show');
  }
})()
$(document).on("keyup", "#credits", function () {
  getConverted()
})
$(document).on("change", "#currency", function () {
  getConverted()
})
function getConverted() {
  let credit = $("#credits").val()
  let currency = $("select#currency option:selected").text()
  $.ajax({
    url: '/apis/convertCurrency',
    data: {
      currencies: credit,
      currency_type: currency,
      type: 'sale'
    },
    type: 'post',
    success: function (data) {
      $("#converted").val(`${data.currency} ${data.currency_format}`)
    }
  })
}
$(".search-label").on("click", function () {
  $(".twitter-typeahead").addClass("searchtoogle")
})

$("html").click(function () {
  $(".twitter-typeahead").removeClass("searchtoogle")
})
$(".webgl-logo").hide()
$(".webgl-content .footer").hide()

$(document).ready(function () {
  $(document).on('click', "#change_profile", function () {
    let selected = $("input[name='avatar']:checked").val()
    $.ajax({
      url: '/api/setProfileImage',
      cache: false,
      data: {
        avatar: selected
      },
      type: 'post',
      success: function (resp) {
        $(".modal").modal("hide")
        $.notify("User Avatar changed", "success")
        $(".profile_picture").attr('src', resp.image)
      }
    })
  })

  $(document).on("click", "#flag", function () {
    let id = $(this).attr("data-message")
    let panel = $(this).attr("data-panel")
    $.ajax({
      url: "/api/flagmessage",
      data: {
        id: id
      },
      type: "post",
      success: function (response) {
        if (response.status) {
          $.notify("Message reported", "success")
          $(`.${panel}`).addClass("flagged")
        } else {
          $.notify("Unable to report message", "success")
        }
      }
    })
  })
})