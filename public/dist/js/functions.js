jQuery(document).ready(function () {
    jQuery(document).on('click', '#change-profile-pic', function (e) { jQuery('#profile_pic_modal').modal({ show: true }); }); jQuery('#profile-pic').on('change', function () {
        jQuery("#preview-profile-pic").html(''); jQuery("#preview-profile-pic").html('Uploading....'); jQuery("#cropimage").ajaxForm({
            target: '#preview-profile-pic', success: function () {
                $("#photo").on('load', () => {
                    let height = document.getElementById("photo").naturalHeight
                    let width = document.getElementById("photo").naturalWidth
                    jQuery('img#photo').imgAreaSelect({ imageHeight: height, imageWidth: width, parent: $('.modal-content'), aspectRatio: '1:1', onSelectEnd: getSizes, });
                })
                jQuery('#image_name').val(jQuery('#photo').attr('file-name'));
            }
        }).submit();
    }); jQuery('#save_crop').on('click', function (e) { e.preventDefault(); params = { targetUrl: '/api/savemage', action: 'save', x_axis: jQuery('#hdn-x1-axis').val(), y_axis: jQuery('#hdn-y1-axis').val(), x2_axis: jQuery('#hdn-x2-axis').val(), y2_axis: jQuery('#hdn-y2-axis').val(), thumb_width: jQuery('#hdn-thumb-width').val(), thumb_height: jQuery('#hdn-thumb-height').val() }; saveCropImage(params); }); function getSizes(img, obj) { var x_axis = obj.x1; var x2_axis = obj.x2; var y_axis = obj.y1; var y2_axis = obj.y2; var thumb_width = obj.width; var thumb_height = obj.height; if (thumb_width > 0) { jQuery('#hdn-x1-axis').val(x_axis); jQuery('#hdn-y1-axis').val(y_axis); jQuery('#hdn-x2-axis').val(x2_axis); jQuery('#hdn-y2-axis').val(y2_axis); jQuery('#hdn-thumb-width').val(thumb_width); jQuery('#hdn-thumb-height').val(thumb_height); } else { alert("Please select portion..!"); } } function saveCropImage(params) {
        jQuery.ajax({
            url: params['targetUrl'], cache: false, dataType: "html", data: { action: params['action'], id: jQuery('#hdn-profile-id').val(), t: 'ajax', w1: params['thumb_width'], x1: params['x_axis'], h1: params['thumb_height'], y1: params['y_axis'], x2: params['x2_axis'], y2: params['y2_axis'], image_name: jQuery('#image_name').val() }, type: 'Post', success: function (response) {
                jQuery('#profile_pic_modal').modal('hide'); jQuery(".imgareaselect-border1,.imgareaselect-border2,.imgareaselect-border3,.imgareaselect-border4,.imgareaselect-border2,.imgareaselect-outer").css('display', 'none'); let resp = JSON.parse(response)
                jQuery(".profile_picture").attr('src', resp.image); jQuery("#preview-profile-pic").html(''); jQuery("#profile-pic").val();
            }, error: function (xhr, ajaxOptions, thrownError) { alert('status Code:' + xhr.status + 'Error Message :' + thrownError); }
        });
    }
}); function checkCredits(credits) { let amount = $('#credits').val(); if (credits - amount < 0) { $('.sendButton').attr('disabled', true); alert('Insufficient balance.') } else { $('.sendButton').attr('disabled', false); } } $(document).ready(function () { $('#search').on("click", (function (e) { $(".form-group1").addClass("sb-search-open"); e.stopPropagation() })); $(document).on("click", function (e) { if ($(e.target).is("#search") === false && $(".typeahead").val() && $(".typeahead").val().length == 0) { $(".form-group1").removeClass("sb-search-open"); } }); $(".form-control-submit").click(function (e) { $(".typeahead").each(function () { if ($(".typeahead").val().length == 0) { e.preventDefault(); $(this).css('border', '2px solid red'); } }) }) })