﻿
(function ($, core) {

    //Template visualisation that inherits from visP.
    "use strict";

    var visName = "vis5";
    var exports = core[visName] = {};

    var spiders = { "name": "spiders", "taxonLevel": "order", "children": [] };
    var tt, root, focus, svg, pack, circleU, circleE, circleM, text, label, pack, view, node, diameter, bSuspendEventHandlers, margin, taxaRoot, g, color;

    exports.Obj = function (parent, contextMenu, core) {

        core.visP.Obj.call(this, visName, parent, contextMenu, core);

        //Initialise the meta data
        this.metadata.title = "Circle-pack key";
        this.metadata.authors = "Rich Burkmar";
        this.metadata.year = "2016";
        this.metadata.publisher = "Field Studies Council";
        this.metadata.location = "Preston Montford, Shropshire";
        this.metadata.contact = null;
        this.metadata.version = "0.1.0";
    }

    exports.Obj.prototype = Object.create(core.visP.Obj.prototype);

    exports.Obj.prototype.initialise = function () {

        var _this = this;

        //Reset this value if control can work with character state input controls
        this.charStateInput = true;

        //Help files
        this.helpFiles = [
            //tombiopath + "vis4/vis4Help.html",
            //tombiopath + "common/imageGroupHelp.html"
        ]

        //Add circle pack stuff
        var zoom = d3.zoom()
          .scaleExtent([1, 100])
          .on('zoom', zoomFn);

        svg = d3.select("#" + this.visName)
            .append("svg")
            .attr("id", "vis5Svg")
            .attr("width", "500")
            .attr("height", "500")
            .call(zoom);

        margin = 20;
        diameter = +svg.attr("width");
        g = svg.append("g").attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")");

        color = d3.scaleLinear()
           .domain([-1, 5])
           .range(["hsl(152,0%,80%)", "hsl(228,0%,40%)"])
           .interpolate(d3.interpolateHcl);

        pack = d3.pack()
            .size([diameter - margin, diameter - margin])
            .padding(2);

        //Parse the knowledge-base to build an object representing the taxa
        //that is suitable for passing to the d3.hierachy function.

        //First build an array of all the Taxonomy characters.
        var taxonRanks = [];
        core.characters.forEach(function (c) {
            if (c.Group == "Taxonomy" || c.Character == "Taxon"){
                taxonRanks.push(c.Character);
            }
        })

        var stratTable = [{ name: "All taxa", parent: "" }], ir = 0;
        //Create a table suitable for input into the d3.stratify function
        taxonRanks.forEach(function (r, iR) {
            core.taxa.forEach(function (t, iT) {
                var rankValue = t[r].kbValue;
                if (rankValue != "" && !stratTable.find(function (entry) { return entry.name == rankValue })) {

                    var rvParent = "";
                    for (var iParent = iR - 1; iParent > -1; iParent -= 1) {
                        rvParent = t[taxonRanks[iParent]].kbValue;
                        if (rvParent != "") break;
                    }
                    if (rvParent == "") rvParent = "All taxa";

                    stratTable.push({ name: rankValue, parent: rvParent, taxon: r == "Taxon" ? t : null, order: iT })
                }
            })
        })

        //Pass to the d3.stratify function to build the an object representing
        //the taxonomic hierarchy suitable for passing to d3.hierarchy
        taxaRoot = d3.stratify()
            .id(function (d) { return d.name; })
            .parentId(function (d) { return d.parent; })
            (stratTable);
    }

    exports.Obj.prototype.refresh = function () {

        var _this = this;

        var maxOverall = d3.max(core.taxa, function (d) { return d.scoreoverall; });
        var minOverall = d3.min(core.taxa, function (d) { return d.scoreoverall; });

        //Prepare scales for the indicators
        //Vermillion-Yellow-Blue http://jfly.iam.u-tokyo.ac.jp/color/
        var scaleOverall = d3.scaleLinear()
            .domain([minOverall, 0, maxOverall])
            .range(['#fc8d59', '#ffffbf', '#91bfdb']);


        var correction = minOverall < 0 ? 0 - minOverall : 0;

        root = d3.hierarchy(taxaRoot)
             .sum(function (d) {
                 return d.data.taxon ? Math.pow(d.data.taxon.scoreoverall + correction + 0.1, 1.5): 0;
             })
             .sort(function (a, b) {
                 //Careful what goes in here. Nonsensical can cause pack to hang.
                 return b.value - a.value;
             });

        focus = root;

        var nodes = pack(root).descendants();

        circleU = g.selectAll("circle")
            .data(nodes, function (d) { return d.data.id });

        circleE = circleU.enter().append("circle")
            .attr("class", function (d) { return d.parent ? d.children ? "node" : "node node--leaf" : "node node--root"; })
            .attr("title", function(d) {
                return d.data.id;
            })
            .on("click", function (d) {
                if (focus !== d) {
                    zoom(d);
                    d3.event.stopPropagation();
                }
            });

        //circleE.append("title").text(function (d) {
        //    return d.data.id;
        //})

        circleM = circleE.merge(circleU);

        var t = d3.transition()
            .duration(750)

        circleM.transition(t)
            .duration(750)
            .style("fill", function (d) {
                if (d.children) {
                    return color(d.depth);
                } else {
                    return scaleOverall(d.data.data.taxon.scoreoverall);
                }
            })

        $(".node").tooltip({
            track: true,
            position: { my: "left+20 center", at: "right center" },
            open: function (event, ui) {
            setTimeout(function () {
                $(ui.tooltip).hide({ effect: "fade", duration: 500 });
            }, 3000);
        }
        });

        text = g.selectAll("text")
            .data(nodes, function (d) { return d.data.id })
            .enter().append("text")
            .attr("class", "label")
            .style("fill-opacity", function (d) { return d.parent === root ? 1 : 0; })
            .style("display", function (d) { return d.parent === root ? "inline" : "none"; })
            .text(function (d) {
                return d.data.id;
            });

        svg
            .style("background", color(-2))
            .on("click", function () { zoom(root); });

        zoomTo([root.x, root.y, root.r * 2 + margin], t);
    }

    function zoom(d) {

        focus = d;
        var focusText = d.data.data.taxon ? focus.parent : focus

        var transition = d3.transition()
            .duration(d3.event.altKey ? 7500 : 750)
            .tween("zoom", function () {
                var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2 + margin]);
                return function (t) { zoomTo(i(t)); };
            });

        transition.selectAll(".label")
            .filter(function (d) {
                if (d.parent === focusText //Child of focus node
                    || this.style.display === "inline"){ //or currently displayed
                    return true;
                } else {
                    return false;
                }
            })
            .style("fill-opacity", function (d) {
                if (d.parent === focusText) {
                    return 1;
                } else {
                    return 0;
                }
            })
            .on("start", function (d) {
                if (d.parent === focusText) this.style.display = "inline";
            })
            .on("end", function (d) {
                if (d.parent !== focusText) this.style.display = "none";
            });
    }

    function zoomTo(v, t) {

       

        var k = diameter / v[2]; view = v;

        if (t) {
            g.selectAll("circle,text").transition(t)
                .duration(750)
                .attr("transform", function (d) { return "translate(" + (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")"; })
                .attr("r", function (d) { return d.r * k; })
        } else {
            g.selectAll("circle,text")
                .attr("transform", function (d) { return "translate(" + (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")"; })
                .attr("r", function (d) { return d.r * k; })
        }

        $(".node").tooltip("close");
    }

    function zoomFn() {

        var dx = d3.event.sourceEvent.movementX * (view[2]/diameter);
        var dy = d3.event.sourceEvent.movementY * (view[2]/diameter);

        var wdy = d3.event.sourceEvent.wheelDeltaY, delta;
        if (wdy) {
            if (wdy > 0) {
                delta =  100/wdy;
            } else {
                delta = Math.abs(wdy/100);
            }
        } else {
            delta = 1;
        }
        var newView = [view[0] - dx, view[1] - dy, view[2] * delta];
    
        zoomTo(newView);
    }
})(jQuery, this.tombiovis)