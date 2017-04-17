/* ~~~~~~~~~~~~~~
 * cloud.js_t
 *~~~~~~~~~~~~~~
 *
 * Various bits of javascript driving the moving parts behind various
 * parts of the cloud theme. Handles things such as toggleable sections,
 * collapsing the sidebar, etc.
 *
 * :copyright: Copyright 2011-2012 by Assurance Technologies
 * :license: BSD
 */



    
    


// begin encapsulation
(function (window, $, _, CST) {

    /*==========================================================================
     * common helpers
     *==========================================================================*/
    var isUndef = _.isUndefined,
        TEXT_NODE = 3, // could use Node.TEXT_NODE, but IE doesn't define it :(
        $window = $(window),
        utils = CST.utils,
        shorten_url = utils.shortenUrl,
        baseUrl = utils.baseUrl;

    // helper that retrieves css property in pixels
    function csspx(elem, prop) {
        return parseInt($(elem).css(prop).replace("px", ""), 10);
    }

    // NOTE: would use $().offset(), but it's document-relative,
    //       and we need viewport-relative... which means getBoundingClientRect().
    // NOTE: 'window.frameElement' will only work we're embedded in an iframe on same domain.
    var parentFrame = window.frameElement;
    if (window.parent && window.parent !== window) {
        $(window.parent).scroll(function () {
            $window.scroll();
        });
    }

    function leftFrameOffset() {
        return parentFrame ? parentFrame.getBoundingClientRect().left : 0;
    }

    function topFrameOffset() {
        return parentFrame ? parentFrame.getBoundingClientRect().top : 0;
    }

    function leftViewOffset($node) {
        return ($node && $node.length > 0) ? $node[0].getBoundingClientRect().left + leftFrameOffset() : 0;
    }

    function topViewOffset($node) {
        return ($node && $node.length > 0) ? $node[0].getBoundingClientRect().top + topFrameOffset() : 0;
    }

    function bottomViewOffset($node) {
        return ($node && $node.length > 0) ? $node[0].getBoundingClientRect().bottom + topFrameOffset() : 0;
    }

    
    function topOffset($target, $parent) {
        if (!($target && $target[0])) {
            return 0;
        }
        var offset = $target[0].getBoundingClientRect().top;
        if ($parent && $parent[0]) {
            offset -= $parent[0].getBoundingClientRect().top;
        }
        else {
            offset += topFrameOffset();
        }
        return offset;
    }

    // return normalized nodename, takes in node or jquery selector
    // (can't trust nodeName, per http://ejohn.org/blog/nodename-case-sensitivity/)
    function nodeName(elem) {
        if (elem && elem.length) {
            elem = elem[0];
        }
        return elem && elem.nodeName.toUpperCase();
    }

    /*==========================================================================
     * Sythesize 'cloud-breakpoint' event
     *==========================================================================
     * Event emitted when crossing small <-> medium media breakpoint
     *==========================================================================*/
    var smallScreen;

    $(function (){
        var $smallDiv = $('<div class="hide-for-small" />').appendTo("body"),
            $html = $("html");
        function update(){
            var test = $smallDiv.css("display") == "none";
            if(test !== smallScreen){
                smallScreen = test;
                $html.toggleClass("small-screen", test)
                     .toggleClass("medium-up-screen", !test);
                $window.trigger("cloud-breakpoint");
            }
        }
        $window.on("DOMContentLoaded load resize", update);
        update();
    });

    /*==========================================================================
     * Highlighter Assist
     *==========================================================================
     * Sphinx's highlighter marks some objects when user follows link,
     * but doesn't include section names, etc. This catches those.
     *==========================================================================*/
    $(function () {
        // helper to locate highlight target based on #fragment
        function locate_target() {
            // find id referenced by #fragment
            var hash = document.location.hash;
            if (!hash) return null;
            var section = document.getElementById(hash.substr(1));
            if (!section) return null;

            // could be div.section, or hidden span at top of div.section
            var name = nodeName(section);
            if (name != "DIV") {
                if (name == "SPAN" && section.innerHTML == "" &&
                    nodeName(section.parentNode) == "DIV") {
                    section = section.parentNode;
                }
                else if (name == "DT" && section.children.length &&
                    $(section).children("tt.descname, code.descname").length > 0) {
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
        if (target) target.addClass("highlighted");

        // update highlight if hash changes
        $window.on("hashchange", function () {
            if (target) target.removeClass("highlighted");
            target = locate_target();
            if (target) target.addClass("highlighted");
        });
    });

    /*==========================================================================
     * Toggleable Sections
     *==========================================================================
     * Added expand/collapse button to any collapsible RST sections.
     * Looks for sections with CSS class "html-toggle",
     * along with the optional classes "expanded" or "collapsed".
     * Button toggles "html-toggle.expanded/collapsed" classes,
     * and relies on CSS to do the rest of the job displaying them as appropriate.
     *==========================================================================*/

    // given "#hash-name-with.periods", escape so it's usable as CSS selector
    // (e.g. "#hash-name-with\\.periods")
    // XXX: replace this with proper CSS.escape polyfill?
    function escapeHash(hash) {
        return hash.replace(/\./g, "\\.");
    }

    $(function () {
        function init() {
            // get header & section, and add static classes
            var header = $(this);
            var section = header.parent();
            header.addClass("html-toggle-button");

            // helper to test if url hash is within this section
            function contains_hash() {
                var hash = document.location.hash;
                return hash && (section[0].id == hash.substr(1) ||
                    section.find(escapeHash(hash)).length > 0);
            }

            // helper to control toggle state
            function set_state(expanded) {
                expanded = !!expanded; // toggleClass et al need actual boolean
                section.toggleClass("expanded", expanded);
                section.toggleClass("collapsed", !expanded);
                section.children().toggle(expanded);
                if (!expanded) {
                    section.children("span:first-child:empty").show();
                    /* for :ref: span tag */
                    header.show();
                }
            }

            // initialize state
            set_state(section.hasClass("expanded") || contains_hash());

            // bind toggle callback
            header.click(function (evt) {
                var state = section.hasClass("expanded")
                if (state && $(evt.target).is(".headerlink")) {
                    return;
                }
                set_state(!state);
                $window.trigger('cloud-section-toggled', section[0]);
            });

            // open section if user jumps to it from w/in page
            $window.on("hashchange", function () {
                if (contains_hash()) set_state(true);
            });
        }

        $(".html-toggle.section > h2, .html-toggle.section > h3, .html-toggle.section > h4, .html-toggle.section > h5, .html-toggle.section > h6").each(init);
    });

    /*==========================================================================
     * mobile menu / collapsible sidebar
     *==========================================================================
     * Instruments sidebar toggle buttons.  Relies on applying classes
     * to div.document in order to trigger css rules that show/hide sidebar.
     * Persists sidebar state via session cookie.
     * Sidebar state for small screens is tracked separately,
     * and is NOT persisted.
     *==========================================================================*/
    $(function () {
        // get nodes
        if (!$(".sphinxsidebar").length) { return; }

        var $doc = $('div.document'),
            $hide = $('button#sidebar-hide'),
            $show = $('button#sidebar-show'),
            copts = {
                // expires: 7,
                path: utils.rootpath
            };

        // set sidebar state for current media size
        var lastSmall = false,
            smallState = false,
            largeState = false;
        function setState(visible){
            $doc.toggleClass("sidebar-hidden", !smallScreen && !visible)
                .toggleClass("document-hidden", smallScreen && visible);
            $hide.toggleVis(visible);
            $show.toggleVis(!visible);
            lastSmall = smallScreen;
            if(smallScreen) {
                smallState = visible;
                if(visible) { largeState = true; }
            } else {
                largeState = visible;
                if(!visible) { smallState = false; }
                $.cookie("sidebar", visible ? "expanded" : "collapsed", copts);
            }
            $window.trigger("cloud-sidebar-toggled", visible);
        }

        // change when buttons clicked
        $show.click(function () { setState(true); });
        $hide.click(function () { setState(false); });

        // refresh sidebar state when crossing breakpoints
        $window.on("cloud-breakpoint", function (){
            setState(smallScreen ? smallState : largeState);
        });

        // load initial state
        if(smallScreen){
            setState(false);
        } else {
            var value = $.cookie("sidebar");
            
            setState(value != "collapsed");
        }

        // make buttons visible now that they're instrumented
        $(".sidebar-toggle-group").removeClass("no-js");
    });

    // flag set by smooth scroller to temporarily disable toc sliding.
    var scrollingActive = false;

    /* ==========================================================================
     * header breaker
     * ==========================================================================
     * attempts to intelligently insert linebreaks into page titles, where possible.
     * currently only handles titles such as "module - description",
     * adding a break after the "-".
     * ==========================================================================*/
    $(function () {
        // get header's content, insert linebreaks
        var header = $("h1");
        var orig = header[0].innerHTML;
        var shorter = orig;
        if ($("h1 > a:first > tt > span.pre").length > 0) {
            shorter = orig.replace(/(<\/tt><\/a>\s*[-\u2013\u2014:]\s+)/im, "$1<br> ");
        }
        else if ($("h1 > tt.literal:first").length > 0) {
            shorter = orig.replace(/(<\/tt>\s*[-\u2013\u2014:]\s+)/im, "$1<br> ");
        }
        if (shorter == orig) {
            return;
        }

        // hack to determine full width of header
        header.css({whiteSpace: "nowrap", position: "absolute"});
        var header_width = header.width();
        header.css({whiteSpace: "", position: ""});

        // func to insert linebreaks when needed
        function layout_header() {
            header[0].innerHTML = (header_width > header.parent().width()) ? shorter : orig;
        }

        // run function now, and every time window is resized
        layout_header();
        $window.on('resize cloud-sidebar-toggled', layout_header);
    });

    

    
        /*==========================================================================
         * smooth scrolling
         * instrument toc links w/in same page to use smooth scrolling
         *==========================================================================*/
        var scrollSpeed = 500;
        $(function () {
            $('.sphinxsidebar a[href^="#"]').click(function (event) {
                var hash = this.hash;
                event.preventDefault();
                scrollingActive = true; // disable toc focus calc
                $('html,body').animate({
                    // NOTE: hash == "" for top of document
                    scrollTop: hash ? $(escapeHash(hash)).offset().top : 0
                }, scrollSpeed).promise().always(function (){
                    // enable & redraw toc focus
                    // xxx: would really like to update *before* animation starts,
                    //      so it's animation happened in parallel to scrolling animation
                    scrollingActive = false;
                    $window.trigger("cloud-sidebar-toggled");
                });
                if (window.history.pushState) {
                    window.history.pushState(null, "", hash || "#");
                }
                $window.trigger("hashchange"); // for toggle section code
            });
        });
    

    
        /*==========================================================================
         * auto determine when admonition should have inline / block title
         * under this mode, the css will default to styling everything like a block,
         * so we just mark everything that shouldn't be blocked out.
         *==========================================================================*/
        $(function () {
            $("div.body div.admonition:not(.inline-title):not(.block-title)" +
                ":not(.danger):not(.error)" +
                ":has(p.first + p.last)").addClass("inline-title");
        });
    

    /*==========================================================================
     * patch sphinx search code to try to and prevent rest markup from showing up
     * in search results
     *==========================================================================*/
    var Search = window.Search;
    if (Search && Search.makeSearchSummary) {
        var sphinxSummary = Search.makeSearchSummary;
        Search.makeSearchSummary = function (text, keywords, hlwords) {
            /* very primitive regex hack to turn headers into dots */
            text = text.replace(/^(\s|\n)*([-#=.])\2{6,}\s*\n/, '');
            text = text.replace(/^([-#=.])\1{6,}\s*$/mg, '\u26AB');
            text = text.replace(/^\s*#\.\s*/mg, '\u2022 ');
            //console.debug("makeSearchSummary: text=%o keywords=%o hlwords=%o", text, keywords, hlwords);
            return sphinxSummary.call(this, text, keywords, hlwords);
        }
    }

    /*==========================================================================
     * toc page styling
     *==========================================================================
     * adds some classes to TOC page so items can be styled.
     * sets li.page and div.highlight-pages markers
     *==========================================================================*/
    $(function () {
        $("div.body div.toctree-wrapper").each(function (){
            var $div = $(this),
                highlight = false;
            $div.find("li").each(function (){
                var $li = $(this),
                    url = baseUrl($li.children("a").attr("href")),
                    $parent = $li.parent("ul").prev("a"),
                    parentUrl = baseUrl($parent.attr("href"));
                if(!$parent.length || parentUrl != url){
                    $li.addClass("page");
                } else {
                    highlight = true;
                }
            });
            if(highlight) { $div.addClass("highlight-pages"); }
        });

        var $toc = $("#table-of-contents div.toctree-wrapper.highlight-pages");
        if($toc.length){
            $('<label id="hide-page-sections"><input type="checkbox" /> Hide page sections</label>')
                .insertBefore($toc).find("input")
                .change(function (evt){
                    $toc.toggleClass("hide-sections", evt.target.checked);
                }).change();
            $(".sphinxglobaltoc > h3").css("margin-top", "4px").wrap('<ul><li class="current active"></li></ul>');
        }
    });

    /* ==========================================================================
     * codeblock lineno aligner
     * if document contains multiple codeblocks, and some have different counts
     * (e.g. 10 lines vs 300 lines), the alignment will look off, since the
     * 300 line block will be indented 1 extra space to account for the hundreds.
     * this unifies the widths of all such blocks (issue 19)
     *==========================================================================*/
    $(function () {
        var $lines = $(".linenodiv pre");
        if (!$lines.length) {
            return;
        }
        // NOTE: using ems so this holds under font size changes
        var largest = Math.max.apply(null, $lines.map(function () {
                return $(this).innerWidth();
            })),
            em_to_px = csspx($lines, "font-size");
        $lines.css("width", (largest / em_to_px) + "em").css("text-align", "right");
    });

    /*==========================================================================
     * codeblock copy helper button
     *==========================================================================
     *
     * Add a [>>>] button on the top-right corner of code samples to hide
     * the '>>>' and '...' prompts and the output and thus make the code
     * copyable. Also hides linenumbers.
     *
     * Adapted from copybutton.js,
     * Copyright 2014 PSF. Licensed under the PYTHON SOFTWARE FOUNDATION LICENSE VERSION 2
     * File originates from the cpython source found in Doc/tools/sphinxext/static/copybutton.js
     *==========================================================================*/
    $(function () {
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
        $blocks.find(".highlight:has(pre .gp)").each(function () {
            var $block = $(this);

            // tracebacks (.gt) contain bare text elements that need to be
            // wrapped in a span to work with .nextUntil() call in setButtonState()
            $block.find('pre:has(.gt)').contents().filter(function () {
                return ((this.nodeType == TEXT_NODE) && (this.data.trim().length > 0));
            }).wrap('<span>');

            // insert button into block
            var $button = $('<button class="copybutton">&gt;&gt;&gt;</button>');
            $block.css("position", "relative").prepend($button);
            setButtonState($button, false);
        });

        // toggle button state when clicked
        $('.copybutton').click(
            function () {
                var $button = $(this);
                setButtonState($button, !$button.hasClass("active"));
            });
    });

    /*==========================================================================
     * nested section helper
     *==========================================================================
     * fills out 'data-nested-label' for nested sections (e.g. those w/in a class def)
     * based on name of containing class.  this is used to generate a "return to top"
     * link w/in nested section header.
     *==========================================================================*/
    
        $(function () {
            var template = _.template(('<%- name %> \\2014\\0020').replace(
                /\\(\d{4})/g, function (m, char) { return String.fromCharCode(parseInt(char,16)); }
            ));
            $(".desc-section > .section-header").each(function (idx, header) {
                var $header = $(header),
                    $parent = $header.closest("dd").prev("dt"),
                    name = $parent.find(".descname").text();
                if (!name) {
                    return;
                }
                $header.attr("data-nested-label", template({name: name, parent: $parent}));
            });
        });
    

    /*==========================================================================
     * eof
     *==========================================================================*/

// end encapsulation
// NOTE: sphinx provides underscore.js as $u
}(window, jQuery, $u, CST));