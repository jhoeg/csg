//===========================================================
// map.js - main module for map
//
//-----------------------------
// TO DO:
// ...add items...
//
//-----------------------------
// BUGS:
// ...add items...
//
//===========================================================

// create module object
if ( window.main === undefined) { window.main = {}; }

//===========================================================
// PROPERTIES

// AGS url
main.AGSurl = "https://txgeo.usgs.gov/arcgis/rest/services/FAS/RioGrandeFASMap/MapServer";

// list of HUC8's to spatially limit CWIS queries to
main.CWIS_HUC8s = "12080001,12080002,12080003,12080004,12080005,12080006,12080007,12080008"; // All CSG sites should fall under this HUC


//===========================================================
// FUNCTIONS

//-----------------------------------------------------------
// init
//   startup function
main.init = function () {
    var funcName = "main [init]: ";
    
    // make map using CWIS
    require(
        [
            "esri/geometry/Extent", "esri/SpatialReference", // study area extent
            "esri/map", "esri/dijit/HomeButton", "esri/dijit/Scalebar", "esri/geometry/webMercatorUtils", // map and widgets
            "esri/layers/ArcGISTiledMapServiceLayer", "esri/layers/ArcGISDynamicMapServiceLayer", // layers
            "dojo/domReady!"
        ], function
        (
            Extent, SpatialReference, // study area
            Map, HomeButton, Scalebar, webMercatorUtils, // map and widgets
            ArcGISTiledMapServiceLayer, ArcGISDynamicMapServiceLayer // layers
        ) {
        
        //......................................
        // esri config: click-drag zoom box style
        esriConfig.defaults.map.zoomSymbol = {
            "style" : "esriSFSSolid",
            "color"   : [0,170,230,30],
            "outline" : {
                "style" : "esriSLSDot",
                "color" : [0,170,230,255],
                "width" : 2
            }
        };
        
        // set study area extent
        main.studyExtent = new Extent( -98, 29, -103, 33, new SpatialReference({wkid:4326}));
        
        //......................................
        // create map
        console.log(funcName + "creating map");
        main.mapSelector = $("#map");
        main.map = new Map( "map", {
            "autoResize"           : true,             // have map automatically resize when browser window / map ContentPane resizes?
            "displayGraphicsOnPan" : true,             // true = graphics are displayed during panning (false can improve performance in IE)
            "extent"               : main.studyExtent, // startup extent
            "fitExtent"            : true,             // true = guaranteed to have the initial extent shown completely on the map
            "lods" : [
              // make sure all basemaps used are befined at all zoom levels allowed below
              //{ 'level' :  0, 'resolution' : 156543.033928000000000, 'scale' : 591657527.591555 }, // farthest out possible
              //{ 'level' :  1, 'resolution' :  78271.516963999900000, 'scale' : 295828763.795777 },
              //{ 'level' :  2, 'resolution' :  39135.758482000100000, 'scale' : 147914381.897889 },
              //{ 'level' :  3, 'resolution' :  19567.879240999900000, 'scale' :  73957190.948944 },
              //{ 'level' :  4, 'resolution' :   9783.939620499960000, 'scale' :  36978595.474472 },
                { 'level' :  5, 'resolution' :   4891.969810249980000, 'scale' :  18489297.737236 }, //  0 <== farthest out allowed
                { 'level' :  6, 'resolution' :   2445.984905124990000, 'scale' :   9244648.868618 }, //  1
                { 'level' :  7, 'resolution' :   1222.992452562490000, 'scale' :   4622324.434309 }, //  2
                { 'level' :  8, 'resolution' :    611.496226281380000, 'scale' :   2311162.217155 }, //  3
                { 'level' :  9, 'resolution' :    305.748113140558000, 'scale' :   1155581.108577 }, //  4
                { 'level' : 10, 'resolution' :    152.874056570411000, 'scale' :    577790.554289 }, //  5
                { 'level' : 11, 'resolution' :     76.437028285073200, 'scale' :    288895.277144 }, //  6
                { 'level' : 12, 'resolution' :     38.218514142536600, 'scale' :    144447.638572 }, //  7
                { 'level' : 13, 'resolution' :     19.109257071268300, 'scale' :     72223.819286 }, //  8
                { 'level' : 14, 'resolution' :      9.554628535634150, 'scale' :     36111.909643 }, //  9
                { 'level' : 15, 'resolution' :      4.777314267949370, 'scale' :     18055.954822 }  // 10 <== farthest in allowed (CWIS graphic points disappear closer in)
              //{ 'level' : 16, 'resolution' :      2.388657133974680, 'scale' :      9027.977411 }
              //{ 'level' : 17, 'resolution' :      1.194328566855050, 'scale' :      4513.988705 }
              //{ 'level' : 18, 'resolution' :      0.597164283559817, 'scale' :      2256.994353 }
              //{ 'level' : 19, 'resolution' :      0.298582141647617, 'scale' :      1128.497176 }  // farthest in possible
            ],
            "logo"                  : false,     // display logo on map?
            "nav"                   : false,     // display pan buttons on map?
            "optimizePanAnimation"  : false,     // skip panning animation when calling map.centerAt() or map.setExtent() ?
            "resizeDelay"           : 300,       // time [millisec] to ignore repeated calls to the resize method
            "showAttribution"       : false,     // enable or disable map attribution in lower right corner of map
            "showInfoWindowOnClick" : true,      // show InfoWindow if Graphic has a defined InfoTemplate when the user clicks the graphic
            "slider"                : true,      // display zoom slider on map?
            "wrapAround180"         : true       // true = continuous pan across dateline; supported in the following cases (see API ref for caveats)
        });
        
        // add basemaps (triggers map on load) and thumb picker
        main.map.addLayer( new ArcGISTiledMapServiceLayer( "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/",                         {"id":"BASEimagery1", "opacity":0.8, "visible":true  }) ); // imagery base (no labels)
        main.map.addLayer( new ArcGISTiledMapServiceLayer( "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/", {"id":"BASEimagery2", "opacity":1.0, "visible":true  }) ); // imagery labels
        main.map.addLayer( new ArcGISTiledMapServiceLayer( "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/",                      {"id":"BASEstreets",  "opacity":1.0, "visible":false }) ); // streets with labels
        main.mapSelector.append('<div id="BasemapThumb" data-new-basemap="streets" title="View streets base map"></div>');
        $("#BasemapThumb").on("click", function() {
            $.each( ["BASEstreets","BASEimagery1","BASEimagery2"], function(idx,layer_id) {
                main.map.getLayer(layer_id).setVisibility( !main.map.getLayer(layer_id).visible ); // toggle basemap layer visibility
            });
            var new_basemap = ( $(this).attr("data-new-basemap")==="streets" ? "imagery" : "streets" ); // toggle new basemap
            $(this)
                .attr( "data-new-basemap", new_basemap )           // update data (updates thumb)
                .prop( "title", "View "+new_basemap+" base map" ); // update hover title
            main.map.getLayer("AGSmask").setOpacity( new_basemap==="streets" ? 0.6 : 0.3 ); // adjust mask opacity (darker for imagery)
        });
        
        //......................................
        // finalize map on load
        main.map.on("load", function() {
            
            //................
            // add widgets
            
            // home button
            main.mapSelector.append('<div id="HomeButton"></div>');
            new HomeButton({
                "map"    : main.map,
                "extent" : main.studyExtent
            }, $("#HomeButton")[0] );
            
            // scalebar
            main.mapSelector.append('<div id="Scalebar" class="map-widget-container"></div>');
            new Scalebar({
                "map"          : main.map,
                "scalebarUnit" : "dual"
            }, $("#Scalebar")[0] );
            
            // lat-lon mouse coords
            main.mapSelector.append('<div id="LatLon" class="map-widget-container"></div>');
            $("#LatLon").html( "Scale 1:" + main.numAddCommas(main.map.getScale().toFixed(0)) ); // init startup
            
            // legend
            main.mapSelector.append('<div id="Legend"></div>');
            
            // last update
            main.mapSelector.append('<div id="LastUpdate" class="map-widget-container h-center-me"></div>');
            main.center_mes();
            
            //................
            // add layers
            
            // AGS layers
            main.map.addLayer( new ArcGISDynamicMapServiceLayer( main.AGSurl, { "id":"AGSmask",   "opacity":0.6, "visible":false }) );  main.map.getLayer("AGSmask"  ).setVisibleLayers([2]); // Rio Grande Study Area Mask (2)
            main.map.addLayer( new ArcGISDynamicMapServiceLayer( main.AGSurl, { "id":"AGSbasins", "opacity":1.0, "visible":true }) );  main.map.getLayer("AGSbasins").setVisibleLayers([0]); // Sub-basins HUC8 (0)
            
            // CWIS layers
            CWIS._caller = "RioGrandeFAS"; // database logging tag
            CWIS.verbose = true;           // turn debug logging on
            CWIS.addLayer(
                "flow",
                { // service opts
                    "HUC8s"       : main.CWIS_HUC8s, // study area made up of these HUC8s
                    "outSiteInfo" : "summary"        // extended site info in popup
                },
                { // layer opts
                    "map"          : main.map,
                    "layer_id"     : "CWISflow",
                    "labels"       : true,
                    "labels_scale" : 300000,
                    "on_success"   : function() { $("#LastUpdate").html( "Real-time data is latest available as of<br/>" + main.formatDate(new Date()) ); main.createPlot(); },
                    "on_update"    : function() { $("#LastUpdate").html( "Real-time data is latest available as of<br/>" + main.formatDate(new Date()) ); }
                }
            );

            // CWIS sites
  //          var layer = L.cwis(
  //             "site", // layer type
  //              { // service options for data retrieval
   //                 siteNumbers: "07227420,07227456,07227458,07227460,07227465,07234150,07295450,07298150,07299575,07299825,07299830,07307550,07307720,08079400,08079570,08079580,08080510,08080650,08080750,08080918,08082900,08117990,08123618,08123620,08125400,08125600,08125700,08127090,08127100,08127101,08127102,08128010,08128095,08128990,08130505,08134400,08136200,08136220,08141100,08143700,08143880,08143905,08367050,08407580,08407581,08407595,08407596,08435660,08436800,08444400,08447200,08449250"
   //             },
   //             { // layer options for data presentation
   //                 shape: "circle",
   //                 radius: 10,
   //                 fillColor: "aqua",
   //                 onSuccess: function (lyr) {
   //                     map.fitBounds(lyr.getBounds());
   //                 }
   //             }
   //         );
   //         map.addLayer(layer);
            //................
            // misc
            
            // no mouse text click-drag on map children after all map elements created
            main.mapSelector.find("*").addClass("click-drag-unselectable");
            
            // size map height to browser height so can see full map
            main.resizeLayout = function() {
                $("#map_container,#map").height( 0.8*$(window).innerHeight() );
            }
            $(window).resize( main.resizeLayout );
            main.resizeLayout();
            
            // zoom to study area, fade out and remove loading
            setTimeout( function() {
                main.map.setExtent( main.studyExtent, true );
                $("#map_loading").fadeOut( 1000, function(){
                    $(this).remove();
                });
            }, 1000);
            
        }); // end map on load
        
        //......................................
        // map events
        
        // update scale-lat-lon text on map when mouse moves over map
        main.map.on("mouse-move,mouse-drag", function (evt) {
            var mp = webMercatorUtils.webMercatorToGeographic(evt.mapPoint);
            $("#LatLon").html( "Scale 1:" + main.numAddCommas(main.map.getScale().toFixed(0)) + "&nbsp;&nbsp;&nbsp;(" + mp.y.toFixed(5) + ", " + mp.x.toFixed(5) + ")");
        });
        
        // update scale when mouse exits map and zoom changes
        main.map.on("mouse-out,zoom-end",  function () {
            $("#LatLon").html( "Scale 1:" + main.numAddCommas(main.map.getScale().toFixed(0)) );
        });
        
        // do not allow navigation outside study extent
        main.lastOkExtent = main.studyExtent;
        main.map.on("extent-change", function () {
            if ( ! main.map.extent.intersects(main.studyExtent) )  {
                // current map extent outside study extent
                console.log("extent-change callback: navigated outside study area - going to last good extent");
                main.map.setExtent(main.lastOkExtent);
            } else {
                // extent OK - reset lastGood
                main.lastOkExtent = main.map.extent;
            }
        });
        
		// create search_api widget in element "search"
        search_api._caller = "RioGrandeFAS"; // set caller
        search_api.create( "search", {
			// ...appearance...
			width : 180,
			// ...searchable area...
            lat_min : main.studyExtent.ymin,
            lat_max : main.studyExtent.ymax,
            lon_min : main.studyExtent.xmin,
            lon_max : main.studyExtent.xmax,
            // ...database search options...
            include_gnis_minor : true, // use all (major and minor) GNIS location categories
            include_usgs_sw    : true, // include USGS SW gages
			include_huc8       : true, // include HUCs
			include_huc10      : true,
			include_huc12      : true,
			
			// what to do when a location is found
            on_result: function(o) {
                // o.result is geojson point feature of location with properties
                    
                // zoom to location
                require(["esri/geometry/Extent"], function(Extent) {
                    main.map.setExtent(
                        new esri.geometry.Extent({
                            xmin: o.result.properties.LonMin,
                            ymin: o.result.properties.LatMin,
                            xmax: o.result.properties.LonMax,
                            ymax: o.result.properties.LatMax,
                            spatialReference: {"wkid":4326}
                        }),
                        true
                    );
                });
                    
                // open popup at location listing all properties
                main.map.infoWindow.setTitle("Search Result");
				main.map.infoWindow.setContent(
                    '<div class="cwis-popup">' +
                        '<h1>' + o.result.properties.Label  + '</h1>' +
                        '<table>' +
                            '<tr><td colspan="2" class="cwis-table-header1">Location Details</td></tr>' +
                            '<tr><td>Name     </td><td>' + o.result.properties.Name     + '</td></tr>' +
                            '<tr><td>Category </td><td>' + o.result.properties.Category + '</td></tr>' +
                            '<tr><td>County   </td><td>' + o.result.properties.County   + '</td></tr>' +
                            '<tr><td>State    </td><td>' + o.result.properties.State    + '</td></tr>' +
                            '<tr><td colspan="2" class="cwis-table-header1">Location Coordinates</td></tr>' +
                            '<tr><td>Latitude </td><td>' + o.result.properties.Lat      + '</td></tr>' +
                            '<tr><td>Longitude</td><td>' + o.result.properties.Lon      + '</td></tr>' +
                            '<tr><td>Elevation</td><td>' + o.result.properties.ElevFt   + '</td></tr>' +
                        '</table>' +
                    '</div>'
                );
                require( ["esri/geometry/Point"], function(Point) {
                    main.map.infoWindow.show(
                        new Point( o.result.properties.Lon, o.result.properties.Lat )
                    );
                });
            }
        });
		
    }); // end require
    
}; // init

//-----------------------------------------------------------
// createPlot
//   create time-series plot using GWIS
main.createPlot = function() {
    var funcName = "main [createPlot]: ";
    console.log(funcName);
    
    // no mouse text click-drag
    $("#plot_sites").addClass("click-drag-unselectable");
    
    // make sure CWIS layer added ok
    if (!main.map || !main.map.getLayer("CWISflow") || !main.map.getLayer("CWISflow").graphics || main.map.getLayer("CWISflow").graphics.length<=0) { return; }
    
    // get all sites added to map grouped by HUC8
    var HUC8s      = [];
    var HUC8_sites = {};
    $.each( main.map.getLayer("CWISflow").graphics, function(idx,graphic) {
        if (isNaN(parseFloat(graphic.attributes.FlowValue))) { return true; } // skip if no flow value
        if (isNaN(parseFloat(graphic.attributes.HUC8     ))) { return true; } // skip if no HUC8 value
        HUC8s.push( graphic.attributes.HUC8 ); // add to HUC8 list
        if (!HUC8_sites[graphic.attributes.HUC8]) { HUC8_sites[graphic.attributes.HUC8] = [];  } // add to HUC8 site lookup
        HUC8_sites[graphic.attributes.HUC8].push({
            "site_no" : graphic.attributes.SiteNumber,
            "site_nm" : graphic.attributes.SiteName
        });
    });
    
    // make HUC8s sorted and unique
    var temp = [];
    $.each(HUC8s, function(idx,val){
        if($.inArray(val,temp) === -1) { temp.push(val); }
    });
    HUC8s = temp.sort();
    
    // add site checkboxes grouped by HUC8
    $.each( HUC8s, function(idx,HUC8) {
        // add non-checkbox header
        $("#plot_sites").append(
            '<input type="checkbox" onclick="main.HUC8plot('+HUC8+');" id="cb_'+HUC8+'" data-HUC8="'+HUC8+'"/>&nbsp;' +
            '<label for="cb_'+HUC8+'">Hydrologic Unit ' + HUC8 + '</label><br/>'
        );
        // add checkboxes for all sites in HUC8
        $.each( HUC8_sites[HUC8], function(idx,site) {
            $("#plot_sites").append(
                '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' +
                '<input type="checkbox" onclick="main.updatePlot();" id="cb_'+site.site_no+'" data-HUC8="'+HUC8+'" data-site-no="'+site.site_no+'" data-site-nm="'+site.site_nm+'" />&nbsp;' +
                '<label for="cb_'+site.site_no+'">' + site.site_no + ' ' + site.site_nm + '</label><br/>'
            );
        });
    });
    
    // set startup plot_data set by menus
    main.plot_data = {
        pcode  : { val:"00060", name:"Streamflow, cubic feet per second"  },
        period : { val:"p1d",   name:"Past 1 Day"                         }
    };
    
    // set startup control state
    main.plot_state = {
        y_logscale : true,
        y_show0    : false,
        x_grid     : true,
        y_grid     : true
    };
    
    // check the 1st checkbox, also makes startup plot
    $("#plot_sites input").eq(0).click();
    
}; // createPlot


//-----------------------------------------------------------
// HUC8plot
//   add or remove all sites in input 'HUC8' based on the HUC8 checkbox state
//   sites in other HUC8s are left alone
//main.HUC8plot = function(HUC8) {
//    var funcName = "main [HUC8plot]: ";
    
    // get checkbox state for HUC8
//    var checked = $("#cb_"+HUC8).prop("checked")
//    console.log(funcName+HUC8+" "+checked);
    
    // check all checkboxes for this HUC8
//    $("#plot_sites input[data-HUC8="+HUC8+"]").prop("checked",checked);
    
    // update plot
//    main.updatePlot();
    
//}; // HUC8plot

//-----------------------------------------------------------
// updatePlot
//   update time-series plot using current control settings
main.updatePlot = function() {
    var funcName = "main [updatePlot]: ";
    console.log(funcName);
    
    // build series to plot from checked boxes and current settings for menus
    var series = [];
    $("#plot_sites input[data-site-no]:checked").each( function() {
        series.push({
            "site"  : $(this).data("site-no"), // checkbox data
            "label" : $(this).data("site-nm"), // checkbox data
            "pcode" : main.plot_data.pcode.val // set by menu
        });
    });
    
    // create plot
    GWIS.plot({
        div_id         : "plot", 
        series         : series,
        iv_or_dv       : "iv",
        period         : main.plot_data.period.val,
        title          : main.plot_data.pcode.name,
        xlabel         : main.plot_data.period.name,
        ylabel         : main.plot_data.pcode.name,
        range_selector : false,
        legend         : "onmouseover",
        controls       : ["full_screen","full_range","y_logscale","y_show0","x_grid","y_grid"],        
        y_logscale     : main.plot_state.y_logscale,
        y_show0        : main.plot_state.y_show0,
        x_grid         : main.plot_state.x_grid,
        y_grid         : main.plot_state.y_grid,
        verbose        : true
    });
    
    // cannot propogate control checkbox state when new plot created because "Plot Unavailable" clears plot object
    // manually set global plot_state when checkboxes change
    $("#plot_checkbox_logscale").change( function() { main.plot_state.y_logscale = $(this).prop("checked"); });
    $("#plot_checkbox_Yshow0"  ).change( function() { main.plot_state.y_show0    = $(this).prop("checked"); });
    $("#plot_checkbox_Xgrid"   ).change( function() { main.plot_state.x_grid     = $(this).prop("checked"); });
    $("#plot_checkbox_Ygrid"   ).change( function() { main.plot_state.y_grid     = $(this).prop("checked"); });
    
}; // updatePlot


//-----------------------------------------------------------
// numAddCommas
//   add commas to an integer (no decimals)
main.numAddCommas = function ( intgr ) {
    
    // regex replace (doesn't handle decimal part correctly)
    while ( /(\d+)(\d{3})/.test(intgr.toString()) ) {
        intgr = intgr.toString().replace(/(\d+)(\d{3})/, '$1'+','+'$2');
    }
    return intgr;
    
}; // numAddCommas


//-----------------------------------------------------------
// formatDate
//   returns formatted date-time string for input Date object:
//   "Thu Apr 10 2014, 4:08 PM"
main.formatDate = function ( dateObj ) {
    
    // get date part
    var dateStr = dateObj.toDateString();
    
    // HH
    var HH = dateObj.getHours(); // hour (from 0-23)
    var AmPm = "AM";
    if (HH >= 12) { AmPm = "PM";    }
    if (HH >  12) { HH   = HH - 12; }
    HH = HH.toString();
    
    // MM
    var MM = dateObj.getMinutes(); // minutes (from 0-59)
    MM = MM.toString();
    if (MM.length < 2) { MM = "0"+MM; }
    
    // return foramtted date & time
    return dateStr + ", " + HH + ":" + MM + " " + AmPm;
    
}; // formatDate


//-----------------------------------------------------------
// center_mes
//   center things that have center-me classes:
//   ".h-center-me" center horizontally only
//   ".v-center-me" center vertically only
//     ".center-me" center both vertically and horizontally
// centering is done relative their parent
// IMPORTANT: will NOT center HIDDEN things
main.center_mes = function () {
    
    // horizontal centering
    $(".h-center-me, .center-me").each( function() {
        $(this).css({ "margin-left" : ( $(this).parent().width() - $(this).width() )/2 + "px" });
    });
    // vertical centering
    $(".v-center-me, .center-me").each( function() {
        $(this).css({ "margin-top" : ( $(this).parent().height() - $(this).height() )/2 + "px" });
    });
    
}; // center_mes
$(window).resize( main.center_mes ); // execute on window resize


//-----------------------------------------------------------
// ...more functions...

// //-----------------------------------------------------------
// // XXX
// //   XXX
// main.XXX = function() {
    // var funcName = "main [XXX]: ";
    // console.log(funcName + "");
    
    // // XXX
    
// }; // XXX


//===========================================================
// END
