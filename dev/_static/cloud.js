/* ~~~~~~~~~~~~~~
 * cloud.js_t
 * ~~~~~~~~~~~~~~
 *
 * Various bits of javascript driving the moving parts behind various
 * parts of the cloud theme. Handles things such as toggleable sections,
 * collapsing the sidebar, etc.
 *
 * :copyright: Copyright 2011-2012 by Assurance Technologies
 * :license: BSD
 */



  
  


// begin encapsulation
(function (window, $, _){

/* ==========================================================================
 * common helpers
 * ==========================================================================*/
var isUndef = _.isUndefined,
    TEXT_NODE = 3; // could use Node.TEXT_NODE, but IE doesn't define it :(

// helper to generate an absolute url path from a relative one.
// absolute paths passed through unchanged.
// paths treated as relative to <base>,
// if base is omitted, uses directory of current document.
function abspath(path, base) {
    var parts = path.split("/"),
        stack = [];
    if (parts[0]) {
      // if path is relative, put base on stack
      stack = (base || document.location.pathname).split("/");
      // remove blank from leading '/'
      if (!stack[0]) { stack.shift(); }
      // discard filename & blank from trailing '/'
      if (stack.length && !(base && stack[stack.length-1])) { stack.pop(); }
    }
    for (var i=0; i < parts.length; ++i) {
      if (parts[i] && parts[i] != '.') {
        if (parts[i] == '..'){
          stack.pop();
        } else {
          stack.push(parts[i]);
        }
      }
    }
    return "/" + stack.join("/");
}

// helper to normalize urls for comparison
// * strips current document's scheme, host, & path from local document links (just fragment will be left)
// * strips current document's scheme & host from internal urls (just path + fragment will be left)
// * makes all internal url paths absolute
// * external urls returned unchanged.
var // hosturl is url to root of host, without trailing '/'
    // allowing netloc segment to be empty to support 'file:///' urls
    hosturl = document.location.href.match(/^[a-z0-9]+:(?:\/\/)?(?:[^@]*@)?[^/]*/)[0],
    docpath = document.location.pathname;
function shorten_url(url) {
  if (url.indexOf(hosturl) == 0) {
    url = url.substr(hosturl.length) || '/';
  } else if (url && url[0] == '.') {
    url = abspath(url);
  }
  if (url.indexOf(docpath) == 0) {
    url = url.substr(docpath.length);
  }
  if (url == "#") { url = ""; } // border case from sphinxlocaltoc
  return url;
}

// helper that retrieves css property in pixels
function csspx(elem, prop) {
  return 1 * $(elem).css(prop).replace(/px$/, '');
}

/* debugging
window.CloudSphinxTheme = {
  hosturl: hosturl,
  docpath: docpath,
  shorten_url: shorten_url,
};
*/

// NOTE: would use $().offset(), but it's document-relative,
//       and we need viewport-relative... which means getBoundingClientRect().
function leftViewOffset($node){ return ($node && $node.length > 0) ? $node[0].getBoundingClientRect().left : 0; }
function topViewOffset($node){ return ($node && $node.length > 0) ? $node[0].getBoundingClientRect().top : 0; }

// return normalized nodename, takes in node or jquery selector
// (can't trust nodeName, per http://ejohn.org/blog/nodename-case-sensitivity/)
function nodeName(elem) {
  if (elem && elem.length) { elem = elem[0]; }
  return elem && elem.nodeName.toUpperCase();
}

/* ==========================================================================
 * highlighter #2
 * ==========================================================================
 *
 * Sphinx's highlighter marks some objects when user follows link,
 * but doesn't include section names, etc. This catches those.
 */
$(document).ready(function (){
  // helper to locate highlight target based on #fragment
  function locate_target(){
    // find id referenced by #fragment
    var hash = document.location.hash;
    if(!hash) return null;
    var section = document.getElementById(hash.substr(1));
    if(!section) return null;

    // could be div.section, or hidden span at top of div.section
    var name = nodeName(section);
    if(name != "DIV"){
      if(name == "SPAN" && section.innerHTML == "" &&
         nodeName(section.parentNode) == "DIV")
      {
          section = section.parentNode;
      }
      else if (name == "DT" && section.children.length &&
               $(section).children("tt.descname, code.descname").length > 0)
      {
        // not a section, but an object definition, e.g. a class, func, or attr
        return $(section);
      }
    }
    // now at section div and either way we have to find title element - h2, h3, etc.
    var header = $(section).children("h2, h3, h4, h5, h6").first();
    return header.length ? header : null;
  }

  // init highlight
  var target = locate_target();
  if(target) target.addClass("highlighted");

  // update highlight if hash changes
  $(window).bind("hashchange", function () {
    if(target) target.removeClass("highlighted");
    target = locate_target();
    if(target) target.addClass("highlighted");
  });
});

/* ==========================================================================
 * toggleable sections
 * ==========================================================================
 *
 * Added expand/collapse button to any collapsible RST sections.
 * Looks for sections with CSS class "html-toggle",
 * along with the optional classes "expanded" or "collapsed".
 * Button toggles "html-toggle.expanded/collapsed" classes,
 * and relies on CSS to do the rest of the job displaying them as appropriate.
 */

$(document).ready(function (){
  function init(){
    // get header & section, and add static classes
    var header = $(this);
    var section = header.parent();
    header.addClass("html-toggle-button");

    // helper to test if url hash is within this section
    function contains_hash(){
      var hash = document.location.hash;
      return hash && (section[0].id == hash.substr(1) ||
              section.find(hash.replace(/\./g,"\\.")).length>0);
    }

    // helper to control toggle state
    function set_state(expanded){
      expanded = !!expanded; // toggleClass et al need actual boolean
      section.toggleClass("expanded", expanded);
      section.toggleClass("collapsed", !expanded);
      section.children().toggle(expanded);
      if (!expanded) {
        section.children("span:first-child:empty").show(); /* for :ref: span tag */
        header.show();
      }
    }

    // initialize state
    set_state(section.hasClass("expanded") || contains_hash());

    // bind toggle callback
    header.click(function (evt){
      var state = section.hasClass("expanded")
      if(state && $(evt.target).is(".headerlink")) { return; }
      set_state(!state);
      $(window).trigger('cloud-section-toggled', section[0]);
    });

    // open section if user jumps to it from w/in page
    $(window).bind("hashchange", function () {
      if(contains_hash()) set_state(true);
    });
  }

  $(".html-toggle.section > h2, .html-toggle.section > h3, .html-toggle.section > h4, .html-toggle.section > h5, .html-toggle.section > h6").each(init);
});
/* ==========================================================================
 * collapsible sidebar
 * ==========================================================================
 *
 * Adds button for collapsing & expanding sidebar,
 * which toggles "document.collapsed-sidebar" CSS class,
 * and relies on CSS for actual styling of visible & hidden sidebars.
 */

$(document).ready(function (){
  if(!$('.sphinxsidebar').length){
    return;
  }
  
    var close_arrow = '«';
    var open_arrow = 'sidebar »';
  
  var holder = $('<div class="sidebartoggle"><button id="sidebar-hide" title="click to hide the sidebar">' +
                 close_arrow + '</button><button id="sidebar-show" style="display: none" title="click to show the sidebar">' +
                 open_arrow + '</button></div>');
  var doc = $('div.document');

  var show_btn = $('#sidebar-show', holder);
  var hide_btn = $('#sidebar-hide', holder);
  var copts = { expires: 7, path: abspath(DOCUMENTATION_OPTIONS.URL_ROOT || "") };

  show_btn.click(function (){
    doc.removeClass("collapsed-sidebar");
    hide_btn.show();
    show_btn.hide();
    $.cookie("sidebar", "expanded", copts);
    $(window).trigger("cloud-sidebar-toggled", false);
  });

  hide_btn.click(function (){
    doc.addClass("collapsed-sidebar");
    show_btn.show();
    hide_btn.hide();
    $.cookie("sidebar", "collapsed", copts);
    $(window).trigger("cloud-sidebar-toggled", true);
  });

  var state = $.cookie("sidebar");


  doc.append(holder);

  if (state == "collapsed"){
    doc.addClass("collapsed-sidebar");
    show_btn.show();
    hide_btn.hide();
  }
});

/* ==========================================================================
 * header breaker
 * ==========================================================================
 *
 * attempts to intelligently insert linebreaks into page titles, where possible.
 * currently only handles titles such as "module - description",
 * adding a break after the "-".
 */
$(document).ready(function (){
  // get header's content, insert linebreaks
  var header = $("h1");
  var orig = header[0].innerHTML;
  var shorter = orig;
  if($("h1 > a:first > tt > span.pre").length > 0){
      shorter = orig.replace(/(<\/tt><\/a>\s*[-\u2013\u2014:]\s+)/im, "$1<br> ");
  }
  else if($("h1 > tt.literal:first").length > 0){
      shorter = orig.replace(/(<\/tt>\s*[-\u2013\u2014:]\s+)/im, "$1<br> ");
  }
  if(shorter == orig){
    return;
  }

  // hack to determine full width of header
  header.css({whiteSpace: "nowrap", position:"absolute"});
  var header_width = header.width();
  header.css({whiteSpace: "", position: ""});

  // func to insert linebreaks when needed
  function layout_header(){
    header[0].innerHTML = (header_width > header.parent().width()) ? shorter : orig;
  }

  // run function now, and every time window is resized
  layout_header();
  $(window).resize(layout_header)
           .bind('cloud-sidebar-toggled', layout_header);
});


/* ==========================================================================
 * toc cleaner
 * ==========================================================================
 *
 * attempts to remove clutter from toc lists.
 * mainly, looks for toc entries with format "{module} -- {desc}"",
 * and reduces them down to just "" to save space.
 */
$(document).ready(function (){
  var $toc = $(".sphinxglobaltoc"),
      candidates = {};

  // scan TOC for module entries
  $toc.find("a.internal.reference:has(.literal:first-child > .pre)").each(function (){
    var $this = $(this),
        text = $this.find(".literal").text();

        // wrap details in .objdesc class
        $this.contents().filter(function (){
          return ((this.nodeType == TEXT_NODE))
        }).wrap('<span class="objdesc"></span>');

        // work out modules that have exactly 1 toc entry
        if (isUndef(candidates[text])) {
          candidates[text] = $this;
        }else{
          candidates[text] = null;
        }
  });

  // for all modules that had unique names, add 'unique' flag
  $.each(candidates, function (text, $entry){
    if ($entry) { $entry.children(".objdesc").addClass("unique"); }
  });

});



/* ==========================================================================
 * auto determine when admonition should have inline / block title
 * under this mode, the css will default to styling everything like a block,
 * so we just mark everything that shouldn't be blocked out.
 * ==========================================================================
 */
$(document).ready(function (){
  $("div.body div.admonition:not(.inline-title):not(.block-title)" +
                           ":not(.danger):not(.error)" +
                           ":has(p.first + p.last)").addClass("inline-title");
});


/* ==========================================================================
 * codeblock lineno aligner
 * if document contains multiple codeblocks, and some have different counts
 * (e.g. 10 lines vs 300 lines), the alignment will look off, since the
 * 300 line block will be indented 1 extra space to account for the hundreds.
 * this unifies the widths of all such blocks (issue 19)
 * ==========================================================================
 */
$(document).ready(function (){
  var $lines = $(".linenodiv pre");
  if(!$lines.length) { return; }
  // NOTE: using ems so this holds under font size changes
  var largest = Math.max.apply(null, $lines.map(function () { return $(this).innerWidth(); })),
      em_to_px = csspx($lines, "font-size");
  $lines.css("width", (largest / em_to_px) + "em").css("text-align", "right");
});

/* ==========================================================================
 * codeblock copy helper button
 * ==========================================================================
 *
 * Add a [>>>] button on the top-right corner of code samples to hide
 * the '>>>' and '...' prompts and the output and thus make the code
 * copyable. Also hides linenumbers.
 *
 * Adapted from copybutton.js,
 * Copyright 2014 PSF. Licensed under the PYTHON SOFTWARE FOUNDATION LICENSE VERSION 2
 * File originates from the cpython source found in Doc/tools/sphinxext/static/copybutton.js
 *
 */
$(document).ready(function() {
  // TODO: enhance this to hide linenos for ALL highlighted code blocks,
  //       and only perform python-specific hiding as-needed.

  // static text
  var hide_text = 'Hide the prompts and output',
      show_text = 'Show the prompts and output';

  // helper which sets button & codeblock state
  function setButtonState($button, active) {
    $button.parent().find('.go, .gp, .gt').toggle(!active);
    $button.next('pre').find('.gt').nextUntil('.gp, .go').css('visibility', active ? 'hidden' : 'visible');
    $button.closest(".highlighttable").find(".linenos pre").css('visibility', active ? 'hidden' : 'visible');
    $button.attr('title', active ? show_text : hide_text);
    $button.toggleClass("active", active);
  }

  // create and add the button to all the code blocks containing a python prompt
  var $blocks = $('.highlight-python, .highlight-python3');
  $blocks.find(".highlight:has(pre .gp)").each(function() {
    var $block = $(this);

    // tracebacks (.gt) contain bare text elements that need to be
    // wrapped in a span to work with .nextUntil() call in setButtonState()
    $block.find('pre:has(.gt)').contents().filter(function() {
      return ((this.nodeType == TEXT_NODE) && (this.data.trim().length > 0));
    }).wrap('<span>');

    // insert button into block
    var $button = $('<button class="copybutton">&gt;&gt;&gt;</button>');
    $block.css("position", "relative").prepend($button);
    setButtonState($button, false);
  });

  // toggle button state when clicked
  $('.copybutton').click(
    function() {
      var $button = $(this);
      setButtonState($button, !$button.hasClass("active"));
    });
});

/* ==========================================================================
 * eof
 * ==========================================================================
 */

// end encapsulation
// NOTE: sphinx provides underscore.js as $u
}(window, jQuery, $u));