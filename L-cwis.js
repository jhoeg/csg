/*
=============================================
L-cwis.js version 1.0
  Current Water Information System (CWIS) Leaflet API.
  JavaScript API for adding real-time USGS water data to a Leaflet web map.

DEPENDENCIES
  JS
    * Leaflet 1.x
  SERVICES
    * CWIS data services (see CONFIGURATION)
    * GWIS plotting API  (see CONFIGURATION)
  OTHER
    * Default popups have links to waterdata.usgs.gov pages (see CONFIGURATION)
    * Default popups have links to USGS Water Alert (see CONFIGURATION)

Written by Joe Vrabel jvrabel@usgs.gov
=============================================
*/
/* globals L */ // for jshint

// check dependencies
if(window.L === undefined) {
    console.warn('[L-cwis] leaflet must be loaded... L-cwis api may not work correctly.');
} else if(parseFloat(L.version) < 1) {
    console.warn('[L-cwis] leaflet version 1+ required... L-cwis api may not work correctly.');
}

//===========================================
// PUBLIC
//===========================================

//...........................................
// L.cwis
//    Create L.featureGroup layer containing real-time USGS data from CWIS services.
//    Returns the layer.
//
// USAGE:
//    layer = L.cwis( <object>options )  // create and return L.featureGroup
//    layer.setOpacity( <number>opacity ).setRadius( <number>radius? ).setOptions( <object>options ).refresh() // chainable extension methods
//
// EXAMPLES:
//    layer = L.cwis({type:'flow', filter:"stateAbbreviation eq 'tx'"}).addTo(map); // create with options and add to map
//    layer.setOptions({theme:'cfs', autoSize:false, markerOptions:{shape:'star'}}).setRadius(15).setOpacity(0.3); // apply methods
//    map.removeLayer(layer); // remove from map
//    layer.setOptions({filter:"stateAbbreviation in('az','nm')", theme:'status', autoSize:1.5, markerOptions:{shape:'circle'}}).setOpacity(1); // apply methods while off map
//    layer.addTo(map); // add back to map
//
//    L.cwis({ type:'flow', theme:'status', filter:"StateName eq 'texas'"                          }).addTo(map); // streamflow in texas symbolized by statistical rank
//    L.cwis({ filter:"ParameterCode eq '00065' and FloodStageStatusCode in('>MNR','>MOD','>MAJ')" }).addTo(map); // streamgages in nation in flood stage
//    L.cwis({ filter:"ParameterCode eq '00065' and RateOfChangeUnitPerHour gt 0.5"                }).addTo(map); // streamgages in nation rising more than 0.5 ft/hr
//    ...
//...........................................
L.cwis = options => {

    //.......................................
    // options
    //.......................................
    const defaults = {

        //...................................
        // data selection
        //...................................

        // filter [string, REQUIRED]
        //   cwis service odata filter for site and data selection
        //   note that additional built-in filtering is performed when 'type' is also specified
        // example: "stateAbbreviation in ('ga','sc') and startswith(SiteTypeCode,'GW') and ParameterCode eq '72019'"
        filter: undefined,

        // type [string, optional]
        //   built-in site and data type filtering
        //   applied in addition to required 'filter' option
        //   one of:
        //     'flow'  - streamflow
        //     'stage' - river stage
        //     'lake'  - lake elevation
        //     'well'  - groundwater level
        //     'rain'  - precipitation
        // example: 'flow'
        type: undefined,

        //...................................
        // symbolization
        //...................................

        // theme [string, optional]
        //   built-in color themes for specified 'type':
        //      'flow' - shape is 'circle', color theme can be:
        //          'status' ... color determined by day-of-year statistic
        //          'cfs' ...... color determined by value
        //          'cfs0' ..... only show sites not flowing (0 cfs)
        //      'stage' - shape is 'circle', color theme can be:
        //          'status'
        //          'rate' ..... color determined by rate-of-change
        //          'flood' .... only show sites in flood stage
        //          'nws' ...... color determined by whether or not sites have NWS flood stages assigned
        //      'lake' - shape is square, color theme can be:
        //          'status'
        //          'rate'
        //      'well' - shape is 'triangle-up', color theme can be:
        //          'status'
        //          'rate'
        //          'depth' .... color determined by water level below land surface
        //      'rain' - shape is 'diamond', color theme can be:
        //          'rate' ..... color determined by rainfall rate
        //          'non0' ..... only show sites with non-0 rainfall
        //   has no effect when 'type' is not specified
        // example: 'status'
        theme: undefined,

        // markerOptions [object|function, optional]
        //   leaflet path options to apply to markers, see: https://leafletjs.com/reference.html#path
        //   options can include L-cwis marker extension options (shape, radius, rotDeg - see L.cwis.Marker at bottom of this file)
        //   can also set to a function that takes feature properties as input and returns an object of options or true/false to filter a feature
        //   markerOptions are merged into and override any shape and colors set by 'theme'
        // example: { shape:'star' } // override default shape
        // example: p => { // blue up-triangles when rising, red down-triangles when falling
        //       return {
        //           shape: p.RateOfChangeUnitPerHour > 0 ? 'triangle-u' : 'triangle-d',
        //           fillColor: p.RateOfChangeUnitPerHour > 0 ? 'blue' : 'red',
        //           stroke: false,
        //           fillOpacity: 1
        //       }
        //   }
        // example: p => p.Value > 10000 // filter: only show markers with Value > 10000
        // example: p => p.Value > 10000 ? {fillColor:'red'} : false // custom styling with filter
        markerOptions: {},

        //...................................
        // popups and tooltips
        //...................................

        // popup [boolean|function, optional]
        //   whether to bind popups to markers
        //   set false for no popups
        //   set true for popups with default content
        //   set to a function for popups with custom content
        //   function takes feature properties as input and returns an html-formatted string of content to display in popup
        //   function can act as a filter by returning false to not bind a popup to a particular marker
        // example: false // no popups
        // example: true  // default popups
        // example: p => `<h3>${p.SiteName}</h3>` // popups with custom content
        // example: p => p.Value > 1000 ? `<h3>${p.SiteName}</h3>Value over 1000` : false // custom content with filter (no popup when Value<1000)
        popup: true,

        // popupOptions [object, optional]
        //   object of leaflet popup options to apply when popups are bound
        //   see: https://leafletjs.com/reference.html#popup
        // example: { keepInView:true, minWidth:500 }
        popupOptions: {},

        // tooltip [boolean|function, optional]
        //   whether to bind tooltips to markers
        //   set false for no tooltips
        //   set true for tooltips with default content
        //   set to a function for tooltips with custom content
        //   function takes feature properties as input and returns an html-formatted string of content to display in tooltip
        //   function can act as a filter by returning false to not bind a tooltip to a particular marker
        //   tooltips are always disabled on mobile devices
        // example: false // no tooltips
        // example: true  // default tooltips
        // example: p => `Value: ${p.Value}` // tooltips with custom content
        // example: p => p.Value > 1000 ? `Value over 1000: ${p.Value}` : false // custom content with filter (no tooltip when Value<1000)
        tooltip: true,

        // tooltipOptions [object, optional]
        //   object of leaflet tooltip options to apply when tooltips are bound
        //   see: https://leafletjs.com/reference.html#tooltip
        // example: { direction:'top', permanent:true }
        tooltipOptions: {},

        //...................................
        // misc
        //...................................

        // autoRefresh [boolean, optional]
        //   whether to automatically refresh the layer realtime data on a scheduled interval (true) or not (false)
        //   note: a layer will not refresh while one of its marker's popups is open
        // example: false
        autoRefresh: true,

        // autoSize [number|function|boolean, optional]
        //   whether to dynamically size marker according to map zoom level
        //   setting 1 enables default auto sizing
        //   setting <1 enables default and adjusts sizes to be smaller than default by a factor <1
        //   setting >1 enables default and adjusts sizes to be larger than default by a factor >1
        //   set to a function to enable using a custom sizing function that takes the map zoom level as input and outputs an integer radius in pixels
        //   set false to keep marker size a constant value independent from the map zoom level
        // example: 1         // default auto sizing
        // example: 0.8       // auto sizing scaled so size is 80% smaller than default
        // example: 1.5       // auto sizing scaled so size is 150% larger than default
        // example: z => z-2  // custom function: set marker radius to the current map zoom level - 2 pixels
        // example: false     // do not auto size
        autoSize: 1,

        //...................................
        // event callbacks
        //...................................

        // onSuccess [function, optional]
        //   function to execute after layer is successfully added to a map
        //   function can have a single argument to access the leaflet FeatureGroup layer
        //   useful for doing creation tasks that require the layer to be populated with markers, such as zooming the map to the layer extent
        // example: lyr => { if(lyr.getBounds().isValid()) map.fitBounds(lyr.getBounds().pad(0.1)); }
        onSuccess: undefined,

        // onRefresh  [function, optional]
        //   function to execute after layer is refreshed (on creation and any subsequent auto or manual refreshes)
        //   function can have a single argument to access the leaflet FeatureGroup layer
        //   useful for doing tasks such as updating interface annotations, for example the last refresh time or the number of points in the layer
        //   note that refreshes do not occur when the layer is not on the map or a marker popup is open
        // example: lyr => console.log(`onRefresh: ${lyr.getLayers().length} sites`)
        onRefresh: undefined,

        // onError [function, optional]
        //   function to execute when an error occurs when populating data after adding to map
        //   function can have 2 arguments to access the leaflet FeatureGroup layer and the error message string
        //   situations resulting in an error include:
        //     - required input options not specified
        //     - one or more input options are invalid
        //     - cwis services are unavailable
        //   errors are logged as console warnings independent of this option
        // example: (lyr, msg) => { console.warn(`could not add layer: ${msg}`); lyr.removeFrom(map); }
        onError: undefined

    };

    // report unrecognized options
    const validOptions = Object.keys(defaults);
    Object.keys(options).forEach(opt => {
        if(!validOptions.includes(opt)) console.warn(`[L.cwis] unrecognized option "${opt}" ignored.`);
    });

    // create empty feature group and add options
    const layer = L.featureGroup([]);
    layer.options = L.cwis.merge(defaults, options || {});

    //.......................................
    // setOpacity
    //   set outline and fill opacity of layer markers
    //   returns layer
    // example: layer.setOpacity(0.5);
    //.......................................
    layer.setOpacity = opacity => {
        layer.options.markerOptions.opacity = opacity;
        layer.options.markerOptions.fillOpacity = opacity;
        return layer.setStyle({
            opacity: opacity,
            fillOpacity: opacity
        });
    };

    //.......................................
    // setRadius
    //   set radius of layer markers
    //   when autoSize option is disabled, input a number to set radius to that number of px
    //   when autoSize is enabled, any input is ignored and radius is set based on current zoom level of map
    //   returns layer
    // example: layer.setRadius(10); // sets marker radius 10px when autoSize disabled
    // example: layer.setRadius(10); // 10 ignored and marker auto sized when autoSize enabled
    // example: layer.setRadius();   // marker auto sized when autoSize enabled
    //.......................................
    layer.setRadius = radius => {
        if(layer.options.autoSize === false && radius === undefined) { // autosize off and no input
            return; // do nothing
        } else if(typeof layer.options.autoSize === 'number') { // autosize enabled, value is scale factor
            radius = layer.options.autoSize * Math.min(Math.max(layer._map.getZoom() - 2, 3), 8); // (zoom - 2) but never <3 or >8
        } else if(typeof layer.options.autoSize === 'function') { // custom function
            radius = layer.options.autoSize(layer._map.getZoom());
        }
        layer.options.markerOptions.radius = radius;
        return layer.setStyle({
            radius: radius
        });
    };

    //.......................................
    // setOptions
    //   change options after creation
    //   input options are merged into existing options and layer is redrawn
    //   returns layer
    // example: layer.setOptions({ type:'well', theme:'depth' }); // change type and theme
    // example: layer.setOptions({ filter:"ParameterCode eq '72019' and Value gt 200" }); // show well water depths for nation greater than 200 feet
    // example: layer.setOptions({ markerOptions:{color:'red', fillColor:'pink', shape:'5gon'} }); // change symbology
    // example: layer.setOptions({ type:undefined, filter:"ParameterCode eq '00065' and startswith(StatisticStatusDescription,'all-time high')" }); // day-of-year record high river stages for nation
    //.......................................
    layer.setOptions = newOptions => {
        // check
        Object.keys(newOptions).forEach(opt => {
            if(!validOptions.includes(opt)) console.warn(`[L.cwis] unrecognized option "${opt}" ignored.`);
        });
        // if different filter or type specified need to refresh layer data (not just redraw to re-symbolize)
        const needRefresh = newOptions.filter && newOptions.filter !== layer.options.filter || newOptions.type && newOptions.type !== layer.options.type;
        // merge new options into existing and refresh or redraw
        layer.options = L.cwis.merge(layer.options, newOptions);
        return needRefresh ? L.cwis._refresh(layer) : L.cwis._redraw(layer);
    };

    //.......................................
    // refresh
    //   refresh layer with results of new data service call
    //   returns layer
    // example: layer.refresh();
    //.......................................
    layer.refresh = () => L.cwis._refresh(layer);

    // init and return layer
    return L.cwis._init(layer);

}; // L.cwis


//===========================================
// CONFIGURATION
//===========================================
L.cwis.version = '1.0';
L.cwis._config = {

    // urls
    cwisUrl: 'https://dashboard.waterdata.usgs.gov/service/cwis/1.0/odata/CurrentConditions', // official domain
    gwisUrl: 'https://dashboard.waterdata.usgs.gov/api/gwis/2.0', // official domain
    // cwisUrl: 'https://webapps.usgs.gov/noms/service/cwis/1.0/odata/CurrentConditions', // test
    // gwisUrl: 'https://webapps.usgs.gov/noms/api/gwis/2.0', // test
    subscribeUrl: 'https://water.usgs.gov/wateralert/subscribe2',
    siteUrl: 'https://waterdata.usgs.gov/monitoring-location',
    dataUrl: 'https://waterdata.usgs.gov/nwis/inventory',

    // auto refresh inteval
    refreshIntervalMs: 2 * 60 * 1000, // 2 minutes

    // max allowed data age, hours
    valueAgeMaxHr: 4,

    // max allowed sites
    nSitesMax: 800,

    // function to return prefilter for all cwis queries
    getPreFilter: () => '(' + [
        "AccessLevelCode eq 'P'", // public access
        'IsPrimary eq true', //      primary for multiple instances of same pcode
        'Value ne null', //          non-null values
        `TimeUtc gt ${new Date(Date.now() - L.cwis._config.valueAgeMaxHr * 60 * 60 * 1000).toISOString()}` // not too old
    ].join(') and (') + ')',

    // builtin filters for type option
    typeFilters: {
        flow: "startswith(SiteTypeCode,'ST') and ParameterCode eq '00060'",
        stage: "startswith(SiteTypeCode,'ST') and ParameterCode eq '00065'",
        lake: "SiteTypeCode eq 'LK' and ParameterCode in ('72335','72275','72264','72214','72020','62614','62615','62616','00065','00062')",
        well: "startswith(SiteTypeCode,'GW') and ParameterCode in ('62610','62611','72019','72150','72229')",
        rain: "ParameterCode in ('00045','72192','00193','72194','99772')"
    },

    // properties to retrieve
    cwisProperties: [
        'AgencyCode', //              string, not null
        'SiteNumber', //              string, not null
        'SiteName', //                string, not null
        'Latitude', //                float,  not null
        'Longitude', //               float,  not null
        'CurrentConditionID', //      int,    not null
        'ParameterCode', //           string, not null
        'ParameterName', //           string, not null
        'ParameterUnit', //           string, not null
        'TimeLocal', //               string, not null
        'TimeZoneCode', //            string, not null
        'Value', //                   float,  can be null in database but odata filter here for not null
        'RateOfChangeUnitPerHour', // float,  null
        'StatisticStatusCode', //     null, 'NR_NOMEAS', 'NR_0FLOW', 'NR_REVFLOW', 'P0', 'P0_10', 'P10_25', 'P25_75', 'P75_90', 'P90_100', 'P100'
        'FloodStageStatusCode' //     null, 'NA', 'NOMEAS', '>MAJ', '>MOD', '>MNR', '>ACT', 'NOFLOOD'
    ],

    // tag for cwis database usage logging
    // specific applications can reset this for custom usage tracking by application
    caller: `L-cwis-${L.cwis.version}`
};


//===========================================
// PRIVATE
//===========================================

//...........................................
// _init
//   setup layer on creation
//   returns layer
//...........................................
L.cwis._init = layer => {

    // set refresh interval
    layer._refreshInterval = setInterval(() => {
        // refresh if auto refresh true, layer is on map, and no popups open
        if(layer.options.autoRefresh && layer._map && document.getElementsByClassName('leaflet-popup').length <= 0) {
            L.cwis._refresh(layer);
        }
    }, L.cwis._config.refreshIntervalMs);

    // on add to map
    layer._zoomend = () => layer.setRadius(); // leaflet needs func ref so can remove later
    layer.on('add', () => {
        if(!layer._json) L.cwis._refresh(layer); //  refresh if no data yet
        layer.setRadius(); //                        autosize on add
        layer._map.on('zoomend', layer._zoomend); // autosize on zoom change
    });

    // on remove from map
    layer.on('remove', () => {
        layer._map.off('zoomend', layer._zoomend); // remove listener
    });

    // done
    return layer;

}; // _init


//...........................................
// _refresh
//   refresh layer with results of new data service call
//   returns layer
//...........................................
L.cwis._refresh = layer => {
    const config = L.cwis._config;
    const options = layer.options;

    // error handler
    const error = err => {
        console.warn(`[L.cwis] service error: ${err}`); // log warning
        if(typeof options.onError === 'function') options.onError(layer, err); // trigger error
        if(layer._refreshInterval) clearInterval(layer._refreshInterval); // clear refresh interval
    };

    // build service url
    const filter = [L.cwis._config.getPreFilter()];
    if(config.typeFilters[options.type]) filter.push(config.typeFilters[options.type]); // add type filter
    if(options.filter && options.filter.trim() !== '') { // add user filter
        filter.push(options.filter);
    } else {
        error('"filter" option must be specified and non-empty.');
        return;
    }
    const url = config.cwisUrl + '?' + [
        '$filter=' + encodeURIComponent('(' + filter.join(') and (') + ')'),
        '$select=' + config.cwisProperties,
        '$top=' + config.nSitesMax,
        'caller=' + config.caller,
        '_=' + Date.now() // no cache timestamp
    ].join('&');

    // make http request
    if(layer._xhr && layer._xhr.readyState !== 4) layer._xhr.abort(); // abort outstanding requests
    layer._xhr = new XMLHttpRequest();
    layer._xhr.onreadystatechange = () => {
        if(layer._xhr.readyState !== XMLHttpRequest.DONE) return;

        // parse as json and check
        let json;
        try {
            json = JSON.parse(layer._xhr.responseText);
        } catch (err) {
            error(`response not json (${err.message})`);
            return;
        }
        if(json.error && json.error.message) {
            error(json.error.message);
            return;
        }
        if(!Array.isArray(json.value)) {
            error('response does not contain "value" array');
            return;
        }
        if(json.value.length >= config.nSitesMax) {
            console.warn(`[L.cwis] warning: max allowed site count exceeded - top ${config.nSitesMax} loaded.`);
        }

        // remove any duplicate sites
        json.value = json.value.filter((value, index, self) =>
            self.findIndex(v => v.AgencyCode === value.AgencyCode && v.SiteNumber === value.SiteNumber) === index
        );

        // add points
        layer._json = json;
        L.cwis._redraw(layer);

        // trigger and disconnect success
        if(typeof options.onSuccess === 'function') {
            options.onSuccess(layer);
            delete options.onSuccess;
        }

        // trigger refresh
        if(typeof options.onRefresh === 'function') options.onRefresh(layer);
    };
    layer._xhr.open('GET', url, true);
    layer._xhr.send();
    return layer;

}; // _refresh


//...........................................
// _redraw
//   clear and re-add data
//   returns layer
//...........................................
L.cwis._redraw = layer => {

    layer.clearLayers();
    layer._json.value.forEach(properties => {
        const marker = L.cwis._getMarker(layer.options, properties);
        if(marker) layer.addLayer(marker);
    });
    return layer;

}; // _redraw


//...........................................
// _getMarker
//   return marker for site properties and options
//...........................................
L.cwis._getMarker = (options, properties) => {

    // set marker based on type and theme
    let markerOptions = {};
    if(options.type && options.theme) {
        try {
            markerOptions = L.cwis._themeColors[options.type][options.theme](properties);
            if(!markerOptions) return false; // filtered (eg: cfs0)
            Object.assign(markerOptions, {
                shape: L.cwis._themeShapes[options.type],
                radius: 6,
                weight: 2,
                fillOpacity: 1
            });
        } catch (error) {
            console.warn(`[L.cwis] invalid "type" option ("${options.type}") and/or "theme" option ("${options.theme}").`);
            return false;
        }
    }

    // get and merge additional marker options
    let optionsMarkerOptions = options.markerOptions || {};
    if(typeof optionsMarkerOptions === 'function') optionsMarkerOptions = optionsMarkerOptions(properties);
    if(!optionsMarkerOptions) return false; // filtered
    markerOptions = L.cwis.merge(markerOptions, optionsMarkerOptions);

    // set interactive options
    markerOptions.interactive = options.popup || options.tooltip; // interactive marker if either popup or tooltip
    options.tooltipOptions.interactive = options.popup && options.tooltip; // clicking tooltip opens popup when have both

    // set marker, bind popup and tooltip as specified, and return
    let marker = L.cwis.marker([properties.Latitude, properties.Longitude], markerOptions);
    let content;
    if(options.popup) {
        content = typeof options.popup === 'function' ? options.popup(properties) : L.cwis._getPopupContent(properties); // custom or builtin
        if(content) marker.bindPopup(content.toString(), options.popupOptions); // do not bind if false (custom filter)
    }
    if(options.tooltip && !L.Browser.mobile) {
        content = typeof options.tooltip === 'function' ? options.tooltip(properties) : L.cwis._getTooltipContent(properties); // custom or builtin
        if(content) marker.bindTooltip(content.toString(), options.tooltipOptions); // do not bind if false (custom filter)
    }
    return marker;

}; // _getMarker


//...........................................
// _themeShapes
//   theme marker shape definitions
//...........................................
L.cwis._themeShapes = {

    flow: 'circle',
    stage: 'circle',
    lake: 'square',
    well: 'triangle-u',
    rain: 'diamond'

}; // _themeShapes


//...........................................
// _themeColors
//   theme marker color definitions
//...........................................
L.cwis._themeColors = {
    /* beautify ignore:start */
    flow: {
        status: p => {
            if( p.Value === 0 )                                         return { color:'#970', fillColor:'#fff' }; // no flow
            if(['>MNR','>MOD','>MAJ'].includes(p.FloodStageStatusCode)) return { color:'#f49', fillColor:'#fff' }; // flooding
            return L.cwis._statusInfo[p.StatisticStatusCode+''].colors; // normal status
        },
        cfs: p => {
            let x = p.Value;
            if( x===null ) return false;
            if( p.ParameterUnit!=='ft3/s' ) return L.cwis._grayColors;
            x = Math.abs(x);
            if( x > 100000 ) return { color:'#015', fillColor:'#239' }; // >100,000 (BIN UNITS: cfs)
            if( x >  10000 ) return { color:'#239', fillColor:'#25a' }; //   10,000 - 100,000
            if( x >   1000 ) return { color:'#25a', fillColor:'#19c' }; //    1,000 -  10,000
            if( x >    100 ) return { color:'#19c', fillColor:'#4bc' }; //      100 -   1,000
            if( x >     10 ) return { color:'#4bc', fillColor:'#7cb' }; //       10 -     100
            if( x >      0 ) return { color:'#7cb', fillColor:'#ceb' }; //        0 -      10
                             return { color:'#970', fillColor:'#fff' }; //        0 (no flow)
        },
        cfs0: p => p.Value===0 ? { color:'#970', fillColor:'#fff' } : false
    },
    stage: {
        status: p => {
            if(['>MNR','>MOD','>MAJ'].includes(p.FloodStageStatusCode)) return { color:'#f49', fillColor:'#fff' }; // flooding
            return L.cwis._statusInfo[p.StatisticStatusCode+''].colors; // normal status
        },
        rate: p => {
            let x = p.RateOfChangeUnitPerHour;
            if( x===null ) return false;
            if( p.ParameterUnit!=='ft' ) return L.cwis._grayColors;
            if( x > +1.00 ) return { color:'#036', fillColor:'#26a' }; // BIN UNITS: ft/hr
            if( x > +0.50 ) return { color:'#26a', fillColor:'#49c' };
            if( x > +0.05 ) return { color:'#49c', fillColor:'#9cd' };
            if( x > -0.05 ) return { color:'#888', fillColor:'#fff' };
            if( x > -0.50 ) return { color:'#d64', fillColor:'#fa8' };
            if( x > -1.00 ) return { color:'#b12', fillColor:'#d64' };
                            return { color:'#601', fillColor:'#b12' };
        },
        flood: p => {
            if(['NOFLOOD','NOMEAS','NA',null].includes(p.FloodStageStatusCode)) return false;
            return L.cwis._floodInfo[p.FloodStageStatusCode+''].colors;
        },
        nws: p => {
            return L.cwis._floodInfo[p.FloodStageStatusCode+''].colors;
        }
    },
    lake: {
        status: p => L.cwis._statusInfo[p.StatisticStatusCode+''].colors,
        rate: p => {
            let x = p.RateOfChangeUnitPerHour;
            if( x===null ) return false;
            if( p.ParameterUnit!=='ft' ) return L.cwis._grayColors;
            if( x > +0.50 ) return { color:'#036', fillColor:'#26a' }; // BIN UNITS: ft/hr
            if( x > +0.05 ) return { color:'#26a', fillColor:'#49c' };
            if( x > +0.02 ) return { color:'#49c', fillColor:'#9cd' };
            if( x > -0.02 ) return { color:'#888', fillColor:'#fff' };
            if( x > -0.05 ) return { color:'#d64', fillColor:'#fa8' };
            if( x > -0.50 ) return { color:'#b12', fillColor:'#d64' };
                            return { color:'#601', fillColor:'#b12' };
        }
    },
    well: {
        //!!!
        // ALL WELL STUFF NEEDS TO BE REVISITED WITH GW DATA CHIEF KNOWLEDGABLE ABOUT ALL THE QUIRKS
        //     * SITE-PARAMETER FILTERING (eg: SP too? what pcodes?)
        //     * SYMBOLOGY
        //         * status - eg: reversed & confusing logic of water depth "above normal" is actually low water / drought condition
        //         * rate of change - all the different scenarios make current logic below suspect
        //         * how show all inconsistent pcodes consistently?
        //
        status: p => L.cwis._statusInfo[p.StatisticStatusCode+''].colors,
        //!!! MESSED UP, SEEMS TO WORK FOR 72019 NOT OTHERS, FLORIDA MESSED UP I THINK CAUSE VALUES BELOW SEA LEVEL? - FIX
        rate: p => {
            let x = p.RateOfChangeUnitPerHour;
            if( x===null ) return false;
            if( p.ParameterUnit!=='ft' ) return L.cwis._grayColors;
            if( p.ParameterCode==='72019' ) x = -x; // reverse depth to water so increasing depth is falling level and vice versa
            x = 12*x; // ft/hr => in/hr
            if( x > +6.0 ) return { color:'#036', fillColor:'#26a' }; // BIN UNITS: in/hr
            if( x > +1.0 ) return { color:'#26a', fillColor:'#49c' };
            if( x > +0.5 ) return { color:'#49c', fillColor:'#9cd' };
            if( x > -0.5 ) return { color:'#888', fillColor:'#fff' };
            if( x > -1.0 ) return { color:'#d64', fillColor:'#fa8' };
            if( x > -6.0 ) return { color:'#b12', fillColor:'#d64' };
                           return { color:'#601', fillColor:'#b12' };
        },
        depth: p => {
            let x = p.Value;
            if( x===null ) return false;
            if( p.ParameterCode!=='72019' ) return L.cwis._grayColors;
            x = Math.abs(x);
            if( x > 250 ) return { color:'#802', fillColor:'#b02' }; // >250  (BIN UNITS: ft below land surface)
            if( x > 200 ) return { color:'#b02', fillColor:'#e11' }; // 200 - 250
            if( x > 150 ) return { color:'#e11', fillColor:'#f42' }; // 150 - 200
            if( x > 100 ) return { color:'#f42', fillColor:'#f83' }; // 100 - 150
            if( x >  50 ) return { color:'#f83', fillColor:'#fb4' }; //  50 - 100
                          return { color:'#fb4', fillColor:'#fd7' }; //   0 -  50
        }
    },
    rain: {
        rate: p => {
            let x = p.RateOfChangeUnitPerHour;
            if( x===null ) return false;
            if(p.ParameterCode!=='00045' ) return L.cwis._grayColors;
            if( x > 4.0 ) return { color:'#b24', fillColor:'#f00' }; // Extreme  (BIN UNITS: in/hr)
            if( x > 2.0 ) return { color:'#204', fillColor:'#528' }; // Violent
            if( x > 0.4 ) return { color:'#528', fillColor:'#87a' }; // Heavy
            if( x > 0.1 ) return { color:'#87a', fillColor:'#bad' }; // Moderate
            if( x > 0.0 ) return { color:'#bad', fillColor:'#dde' }; // Light
                          return { color:'#888', fillColor:'#fff' }; // None
        },
        non0: p => {
            let x = p.RateOfChangeUnitPerHour;
            if( x===null || x<=0 ) return false;
            if(p.ParameterCode!=='00045' ) return L.cwis._grayColors;
            if( x > 4.0 ) return { color:'#b24', fillColor:'#f00' }; // Extreme  (BIN UNITS: in/hr)
            if( x > 2.0 ) return { color:'#204', fillColor:'#528' }; // Violent
            if( x > 0.4 ) return { color:'#528', fillColor:'#87a' }; // Heavy
            if( x > 0.1 ) return { color:'#87a', fillColor:'#bad' }; // Moderate
            if( x > 0.0 ) return { color:'#bad', fillColor:'#dde' }; // Light
            return false;
        }
    }
    /* beautify ignore:end */
}; // _themeColors


//...........................................
// _grayColors
//   gray outline and fill colors
//...........................................
L.cwis._grayColors = {
    color: '#777777',
    fillColor: '#a6a6a6'
};


//...........................................
// _statusInfo
//   info for statistical status
//...........................................
L.cwis._statusInfo = {
    /* beautify ignore:start */
    P0         : { colors:{ color:'#900', fillColor:'#f00' }, description:'All-time low '      + 'for this day-of-year'            }, // red
    P0_10      : { colors:{ color:'#611', fillColor:'#b22' }, description:'Much below normal ' + 'for this day-of-year'            }, // maroon
    P10_25     : { colors:{ color:'#960', fillColor:'#fa0' }, description:'Below normal '      + 'for this day-of-year'            }, // orange
    P25_75     : { colors:{ color:'#090', fillColor:'#0f0' }, description:'Normal '            + 'for this day-of-year'            }, // green
    P75_90     : { colors:{ color:'#1aa', fillColor:'#4dd' }, description:'Above normal '      + 'for this day-of-year'            }, // aqua
    P90_100    : { colors:{ color:'#009', fillColor:'#00f' }, description:'Much above normal ' + 'for this day-of-year'            }, // blue
    P100       : { colors:{ color:'#000', fillColor:'#005' }, description:'All-time high '     + 'for this day-of-year'            }, // black
    NR_0FLOW   : { colors:{ color:'#777', fillColor:'#fff' }, description:'Not ranked - '      + 'stream not flowing'              }, // gray
    NR_REVFLOW : { colors:{ color:'#777', fillColor:'#fff' }, description:'Not ranked - '      + 'stream can have reversible flow' }, // gray
    null       : { colors:{ color:'#777', fillColor:'#fff' }, description:'Not ranked - '      + 'insufficient record'             }  // gray
    /* beautify ignore:end */
};


//...........................................
// _floodInfo
//   info for nws flood stages
//...........................................
L.cwis._floodInfo = {
    /* beautify ignore:start */
    NOFLOOD : { colors:{ color:'#72b026', fillColor:'#a0da58' }, description:'Not flooding'                 }, // green
    '>ACT'  : { colors:{ color:'#f9de00', fillColor:'#ffea4d' }, description:'In action stage'           }, // yellow
    '>MNR'  : { colors:{ color:'#f69730', fillColor:'#fac185' }, description:'In minor flood stage'      }, // orange
    '>MOD'  : { colors:{ color:'#d63e2a', fillColor:'#e78b7e' }, description:'In moderate flood stage'   }, // red
    '>MAJ'  : { colors:{ color:'#d252b9', fillColor:'#e59ad6' }, description:'In major flood stage'      }, // purple
    NOMEAS  : { colors:{ color:'#777777', fillColor:'#a6a6a6' }, description:'No measurement'               }, // gray
    NA      : { colors:{ color:'#777777', fillColor:'#ffffff' }, description:'Flood stages not established' }, // gray
    null    : { colors:{ color:'#777777', fillColor:'#ffffff' }, description:'Flood stages not established' }  // gray
    /* beautify ignore:end */
};


//...........................................
// _getPopupContent
//   return default popup content for input properties
//...........................................
L.cwis._getPopupContent = properties => {

    // gwis plot url and popup size
    const plotUrl = `${L.cwis._config.gwisUrl}/service/site?agencyCode=${properties.AgencyCode}&siteNumber=${properties.SiteNumber}&open=${properties.CurrentConditionID}`;
    const plotWH = [
        `width=${ Math.min( 0.9*window.screen.width, 1000 ) }`,
        `height=${ 0.8*window.screen.height }`,
        'left=10', 'top=10'
    ].join(',');

    // build info annotation
    const info = [];
    // if(properties.StatisticStatusCode !== null) info.push(L.cwis._statusInfo[properties.StatisticStatusCode].description); //!!!DO THIS
    if(properties.StatisticStatusCode !== null && !['62610', '62611', '72019', '72150', '72229'].includes(properties.ParameterCode)) { //!!!
        //!!!TEMPORARY - DO NOT SHOW STAT STATUS FOR WELLS (confusing logic of water depth "above normal" is actually low water / drought condition)
        info.push(L.cwis._statusInfo[properties.StatisticStatusCode].description);
    }
    if(properties.RateOfChangeUnitPerHour !== null) info.push(`Changing ${properties.RateOfChangeUnitPerHour.toFixed(1)} ${properties.ParameterUnit} per hour`);
    let infoHtml = '';
    if(info.length) infoHtml = /*html*/ `<div style="border:1px solid #31708f; background:#ebf3f9; color:#31708f; padding:5px 15px; margin-bottom:5px;">
        ${ '<i class="fas fa-info-circle"></i>&nbsp; ' + info.join('<br><i class="fas fa-info-circle"></i>&nbsp; ') }
    </div>`;

    // build flood annotations
    let floodHtml = '';
    if(properties.FloodStageStatusCode !== null && properties.FloodStageStatusCode.startsWith('>')) floodHtml = /*html*/ `<div style="border:1px solid #9f875b; background:#fcf8e3; color:#9f875b; padding:5px 15px; margin-bottom:5px;">
        <i class="fas fa-exclamation-triangle"></i>&nbsp; ${L.cwis._floodInfo[properties.FloodStageStatusCode].description}
    </div>`;

    // return popup html
    return /*html*/ `<div style="min-width:300px;">
        <!-- title -->
        ${properties.SiteNumber} ${properties.SiteName.toUpperCase()}
        <div style="display:flex; justify-content:left; align-items:center; border-top:1px solid #ddd; margin-top:2px; padding:5px 0 5px;">
            <!-- plot button -->
            <div style="text-align:center; border:1px solid #ccc; background:#f8f9fa; margin-right:15px; padding:5px 15px; cursor:pointer;"
                onmouseover="this.style.background='#e2e6ea'"
                 onmouseout="this.style.background='#f8f9fa'"
                    onclick="const win=window.open('${plotUrl}','_blank','${plotWH}'); win.focus();"
            >
                <img style="width:30px;" src="data:image/svg+xml;utf8;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iaXNvLTg4NTktMSI/Pgo8IS0tIEdlbmVyYXRvcjogQWRvYmUgSWxsdXN0cmF0b3IgMTkuMC4wLCBTVkcgRXhwb3J0IFBsdWctSW4gLiBTVkcgVmVyc2lvbjogNi4wMCBCdWlsZCAwKSAgLS0+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgdmVyc2lvbj0iMS4xIiBpZD0iQ2FwYV8xIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iMCAwIDQ4MC4xODIgNDgwLjE4MiIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgNDgwLjE4MiA0ODAuMTgyOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgd2lkdGg9IjUxMnB4IiBoZWlnaHQ9IjUxMnB4Ij4KPGc+Cgk8Zz4KCQk8cGF0aCBkPSJNMjAwLjE4MiwzMi4xMDZjLTkyLjc4NCwwLTE2OCw3NS4yMTYtMTY4LDE2OHM3NS4yMTYsMTY4LDE2OCwxNjhzMTY4LTc1LjIxNiwxNjgtMTY4ICAgIEMzNjguMDgxLDEwNy4zNjQsMjkyLjkyNCwzMi4yMDcsMjAwLjE4MiwzMi4xMDZ6IE0yMDAuMTgyLDQ4LjEwNmM0OS40MTYsMC4wMzksOTUuNzIzLDI0LjEyMywxMjQuMTI4LDY0LjU2bC0yMCwyMCAgICBjLTQuODY3LTIuOTQ1LTEwLjQzOS00LjUyMS0xNi4xMjgtNC41NmMtMTcuNjczLDAtMzIsMTQuMzI3LTMyLDMyYzAuMDI4LDUuNjk1LDEuNTk1LDExLjI3Niw0LjUzNiwxNi4xNTJsLTUyLjM4NCw1Mi4zODQgICAgYy05LjkxOS02LjA0OC0yMi4zODUtNi4wNDgtMzIuMzA0LDBsLTM2LjM4NC0zNi4zODRjMi45NDEtNC44NzYsNC41MDgtMTAuNDU3LDQuNTM2LTE2LjE1MiAgICBjMC4wMjItMTcuNjM4LTE0LjI1OC0zMS45NTQtMzEuODk2LTMxLjk3NmMtMTQuNTg3LTAuMDE4LTI3LjMzMiw5Ljg0OS0zMC45NjgsMjMuOTc2aC0yOS42OCAgICBDNjYuNzg1LDk4LjE1OSwxMjguNjE0LDQ4LjIxMSwyMDAuMTgyLDQ4LjEwNnogTTMwNC4xODIsMTYwLjEwNmMwLDguODM3LTcuMTYzLDE2LTE2LDE2cy0xNi03LjE2My0xNi0xNnM3LjE2My0xNiwxNi0xNiAgICBTMzA0LjE4MiwxNTEuMjY5LDMwNC4xODIsMTYwLjEwNnogTTIwOC4xODIsMjU2LjEwNmMwLDguODM3LTcuMTYzLDE2LTE2LDE2cy0xNi03LjE2My0xNi0xNmMwLTguODM3LDcuMTYzLTE2LDE2LTE2ICAgIFMyMDguMTgyLDI0Ny4yNjksMjA4LjE4MiwyNTYuMTA2eiBNMTI4LjE4MiwxNzYuMTA2YzAsOC44MzctNy4xNjMsMTYtMTYsMTZzLTE2LTcuMTYzLTE2LTE2czcuMTYzLTE2LDE2LTE2ICAgIFMxMjguMTgyLDE2Ny4yNjksMTI4LjE4MiwxNzYuMTA2eiBNMjc0LjAzNiwzMzMuMDEyYy0yMi41OTIsMTIuNTQ0LTQ4LjAxMiwxOS4xMTYtNzMuODU0LDE5LjA5MyAgICBjLTgzLjg5LDAuMDU3LTE1MS45NDMtNjcuOTAyLTE1Mi0xNTEuNzkyYy0wLjAwNC01LjQxNCwwLjI4Mi0xMC44MjUsMC44NTYtMTYuMjA4aDMyLjI4YzMuNjM3LDE0LjA4NSwxNi4zMTcsMjMuOTQ1LDMwLjg2NCwyNCAgICBjNS42OTUtMC4wMjgsMTEuMjc2LTEuNTk1LDE2LjE1Mi00LjUzNmwzNi4zODQsMzYuMzg0Yy0yLjk0MSw0Ljg3Ni00LjUwOCwxMC40NTctNC41MzYsMTYuMTUyYzAsMTcuNjczLDE0LjMyNywzMiwzMiwzMiAgICBzMzItMTQuMzI3LDMyLTMyYy0wLjAyOC01LjY5NS0xLjU5NS0xMS4yNzYtNC41MzYtMTYuMTUybDUyLjM4NC01Mi4zODRjNC44NzYsMi45NDEsMTAuNDU3LDQuNTA4LDE2LjE1Miw0LjUzNiAgICBjMTcuNjczLDAsMzItMTQuMzI3LDMyLTMyYy0wLjAyOC01LjY5NS0xLjU5NS0xMS4yNzYtNC41MzYtMTYuMTUybDE3LjQ0LTE3LjQzMkMzNzMuODAxLDE5OS44NDksMzQ3LjM2MywyOTIuMjk4LDI3NC4wMzYsMzMzLjAxMiAgICB6IiBmaWxsPSIjMDAwMDAwIi8+Cgk8L2c+CjwvZz4KPGc+Cgk8Zz4KCQk8cGF0aCBkPSJNNDAwLjE4Miw4MC4xMDZjMTQuNTQ3LTAuMDU1LDI3LjIyNy05LjkxNCwzMC44NjQtMjRoNDkuMTM2di0xNmgtNDkuMTM2Yy0zLjYzNy0xNC4wODYtMTYuMzE3LTIzLjk0NS0zMC44NjQtMjQgICAgYy0xNy42NzMsMC0zMiwxNC4zMjctMzIsMzJjMC4wMjgsNS42OTUsMS41OTUsMTEuMjc2LDQuNTM2LDE2LjE1MmwtMTQuMDU2LDE0LjA1NkMyOTEuNDA3LTkuMzA3LDE2NS44NTUtMjUuODE3LDc4LjIzNCw0MS40MzggICAgUy0yNS44OTcsMjM0LjI0Niw0MS4zNTgsMzIxLjg2N2M2My40ODQsODIuNzA3LDE3OS44NTUsMTAyLjc3LDI2Ny4zNjgsNDYuMDk1bDI0LjE0NCwyNC4xNDRsMTEuMzEyLDExLjMxMmw2NC40LDY0LjQgICAgYzE2LjM3OSwxNi4zNzksNDIuOTMzLDE2LjM3OSw1OS4zMTIsMGMxNi4zNzktMTYuMzc5LDE2LjM3OS00Mi45MzMsMC01OS4zMTJsLTY0LjQtNjQuNGwtMTEuMzEyLTExLjMxMmwtMjQuMTQ0LTI0LjE0NCAgICBjNDIuODU5LTY2LjAxNiw0Mi44NTktMTUxLjA3MSwwLTIxNy4wODhsMTYtMTZDMzg4LjkxMSw3OC41MDQsMzk0LjQ5LDgwLjA3NCw0MDAuMTgyLDgwLjEwNnogTTQwMC4xODIsMzIuMTA2ICAgIGM4LjgzNywwLDE2LDcuMTYzLDE2LDE2cy03LjE2MywxNi0xNiwxNnMtMTYtNy4xNjMtMTYtMTZTMzkxLjM0NiwzMi4xMDYsNDAwLjE4MiwzMi4xMDZ6IE00NTYuNTgyLDQxOS44MTggICAgYzEwLjI0NiwxMC4wMTYsMTAuNDMzLDI2LjQ0MiwwLjQxNywzNi42ODhjLTEwLjAxNiwxMC4yNDYtMjYuNDQyLDEwLjQzMy0zNi42ODgsMC40MTdjLTAuMTQxLTAuMTM3LTAuMjc5LTAuMjc2LTAuNDE3LTAuNDE3ICAgIGwtNjQuNC02NC40bDM2LjY4OC0zNi42ODhMNDU2LjU4Miw0MTkuODE4eiBNMzgwLjg3LDM0NC4xMDZsLTM2LjY4OCwzNi42ODhsLTIyLjE0NC0yMi4xNDRjMS4xMjgtMC44NjQsMi4xODQtMS44MTYsMy4yOTYtMi43MDQgICAgczIuNC0xLjk1MiwzLjU5Mi0yLjk1MmMxLjc1Mi0xLjQ3MiwzLjQ4LTIuOTYsNS4xNzYtNC40ODhjMC44NzItMC44LDEuNzA0LTEuNiwyLjU2LTIuNGMzLjI4LTMuMDcyLDYuNDU2LTYuMjQ4LDkuNTI4LTkuNTI4ICAgIGMwLjgtMC44NTYsMS42LTEuNjg4LDIuNC0yLjU2YzEuNTI4LTEuNjk2LDMuMDE2LTMuNDI0LDQuNDg4LTUuMTc2YzEuMDAzLTEuMTg0LDEuOTg3LTIuMzgxLDIuOTUyLTMuNTkyICAgIGMwLjg4LTEuMTA0LDEuODMyLTIuMTYsMi42OTYtMy4yODhMMzgwLjg3LDM0NC4xMDZ6IE0zNDkuODQ2LDMwNi45NDZjLTIuNTIsMy41Mi01LjEyLDYuOTY4LTcuODY0LDEwLjI4OCAgICBjLTAuOCwwLjk2OC0xLjY1NiwxLjkwNC0yLjQ4LDIuODU2Yy0yLjQ0OCwyLjg0OC00Ljk3Niw1LjYxMS03LjU4NCw4LjI4OGMtMS4xMzYsMS4xNzMtMi4yOTEsMi4zMjgtMy40NjQsMy40NjQgICAgYy0yLjY2NywyLjYwOC01LjQyOSw1LjEzNi04LjI4OCw3LjU4NGMtMC45NTIsMC44LTEuODg4LDEuNjcyLTIuODU2LDIuNDhjLTMuMzIsMi43NDQtNi43NjgsNS4zNDQtMTAuMjg4LDcuODY0ICAgIGMtODIuODE2LDU5LjE2NS0xOTcuOTE1LDM5Ljk5Mi0yNTcuMDgtNDIuODI0UzkuOTUsMTA5LjAzMSw5Mi43NjYsNDkuODY2UzI5MC42ODEsOS44NzMsMzQ5Ljg0Niw5Mi42OSAgICBDMzk1LjYyNywxNTYuNzcyLDM5NS42MjcsMjQyLjg2NCwzNDkuODQ2LDMwNi45NDZ6IiBmaWxsPSIjMDAwMDAwIi8+Cgk8L2c+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPC9zdmc+Cg==">
                <div>Graphs</div>
            </div>
            <!-- measurement -->
            <div>
                ${properties.ParameterName}<br>
                <b>${properties.Value} &nbsp;${properties.ParameterUnit}</b><br>
                <b>${properties.TimeLocal.replace('T',' ').replace(/:[0-9]{2}Z$/u,'')} ${properties.TimeZoneCode}</b>
            </div>
        </div>
        <!-- info and flood annotations -->
        ${infoHtml}
        ${floodHtml}
        <!-- bottom buttons -->
        <div style="display:flex; text-align:center; cursor:pointer;">
            <!-- subscribe -->
            <div style="flex-basis:0; flex-grow:1; border:1px solid #ccc; background:#f8f9fa; padding:5px;"
                onmouseover="this.style.background='#e2e6ea'"
                 onmouseout="this.style.background='#f8f9fa'"
                    onclick="window.open('${L.cwis._config.subscribeUrl}?site_no=${properties.SiteNumber}&type_cd=ALL','_blank')"
            >
                <i class="fas fa-external-link-alt"></i> Subscribe
            </div>
            <!-- site page -->
            <div style="flex-basis:0; flex-grow:1; border:1px solid #ccc; background:#f8f9fa; padding:5px; margin:0 5px;"
                onmouseover="this.style.background='#e2e6ea'"
                 onmouseout="this.style.background='#f8f9fa'"
                    onclick="window.open('${L.cwis._config.siteUrl}/${properties.SiteNumber}/','_blank')"
            >
                <i class="fas fa-external-link-alt"></i> Site Page
            </div>
            <!-- data -->
            <div style="flex-basis:0; flex-grow:1; border:1px solid #ccc; background:#f8f9fa; padding:5px;"
                onmouseover="this.style.background='#e2e6ea'"
                 onmouseout="this.style.background='#f8f9fa'"
                    onclick="window.open('${L.cwis._config.dataUrl}?site_no=${properties.SiteNumber}','_blank')"
            >
                <i class="fas fa-external-link-alt"></i> Data
            </div>
        </div>
    </div>`;

}; // _getPopupContent


//...........................................
// _getTooltipContent
//   return default tooltip content for input properties
//...........................................
L.cwis._getTooltipContent = properties => {

    return /*html*/ `
        <div style="text-align:center;">
            ${properties.SiteName.toUpperCase()}<br>
            ${properties.ParameterName}: ${properties.Value.toLocaleString()}
        </div>`;

}; // _getTooltipContent


//...........................................
// merge
//   deep or shallow object merge utility
//     usage: merged = merge( [deep?], obj1, obj2, obj3, ... )
//   example: merged = merge(          obj1, obj2, obj3, ... )  // deep    merge of input objects (default)
//   example: merged = merge( true,    obj1, obj2, obj3, ... )  // deep    merge of input objects (deep option true )
//   example: merged = merge( false,   obj1, obj2, obj3, ... )  // shallow merge of input objects (deep option false)
//...........................................
L.cwis.merge = (...args) => {

    // get deep option
    let deep = true;
    let i = 0;
    if(typeof args[0] === 'boolean') {
        deep = args[0];
        i++;
    }
    // recursive function to merge obj into target
    let target = {};
    const mergeObj = obj => {
        for(let prop in obj) {
            if(obj.hasOwnProperty(prop)) {
                if(deep && Object.prototype.toString.call(obj[prop]) === '[object Object]') {
                    // deep merge and prop is an obj
                    target[prop] = L.cwis.merge(target[prop], obj[prop]);
                } else {
                    // shalow merge
                    target[prop] = obj[prop];
                }
            }
        }
    };
    // merge all input args
    for(; i < args.length; i++) mergeObj(args[i]);
    return target;

}; // merge


//...........................................
// L.cwis.Marker
//   Additional SVG markers for leaflet.
//   Extends the path class.
//
// extension options:
//   shape  [string, default 'circle'] shape, see below
//   radius [number, default 10      ] radius (half total width) of the svg marker in pixels
//   rotDeg [number, default 0       ] clockwise rotation angle to apply to shape, in degrees
//
// available shapes:
//   generalized base shapes:
//     '#gon'   - N-sided regular polygon where N is an integer, eg: '5gon'   is a pentagon
//     '#star'  - N-pointed star          where N is an integer, eg: '5star'  is a 5-pointed star
//     '#cross' - N-armed cross           where N is an integer, eg: '4cross' is a plus-shaped cross
//   supported polygon aliases:
//     'triangle', 'triangle-u' (up), 'triangle-d' (down), 'triangle-l' (left), 'triangle-r' (right), 'square', 'diamond', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'nonagon', 'decagon'
//   supported star aliases:
//     'star' (5-pointed)
//   supported cross aliases:
//     'cross', 'plus', 'x', 'asterisk'
//   a circle is drawn if none of the above
//
// example:
//    let square = L.cwis.marker([51.505, -0.09], {
//        shape: 'square',
//        radius: 20
//    }).addTo(map);
//
// also accepts all leaflet Path options:
//    let diamond = L.cwis.marker([51.505, -0.09], {
//        shape: 'diamond',
//        fillColor: '#ccc',
//        color: 'black',
//        shape: 'diamond',
//        radius: 200
//    }).addTo(map);
//
// additional methods:
//
//   .setLatLng(latlng) [returns this  ] set the position of a marker to a new location
//   .getLatLng()       [returns LatLng] return the current geographical position of the marker
//
//   .setRadius(radius) [returns this  ] sets the radius of a marker, in pixels
//   .getRadius()       [returns this  ] return the current radius of the marker in pixels
//
//   .setStyle(options) [returns this  ] change the appearance using the input Path options object
//
//   .toGeoJSON()       [returns Object] returns a GeoJSON representation of the marker (GeoJSON Point Feature)
//    
// adapted from: https://github.com/rowanwins/Leaflet.SvgShapeMarkers
//...........................................

// constructor
L.cwis.Marker = L.Path.extend({

    // creation options
    options: {
        fill: true,
        shape: 'circle',
        radius: 10,
        rotDeg: 0
    },
    initialize: function (latlng, options) {
        L.setOptions(this, options);
        this._latlng = L.latLng(latlng);
        this._radius = this.options.radius;
    },

    // public methods
    setLatLng: function (latlng) {
        this._latlng = L.latLng(latlng);
        this.redraw();
        return this.fire('move', {
            latlng: this._latlng
        });
    },
    getLatLng: function () {
        return this._latlng;
    },
    setRadius: function (radius) {
        this.options.radius = this._radius = radius;
        return this.redraw();
    },
    getRadius: function () {
        return this._radius;
    },
    setStyle: function (options) {
        let radius = options && options.radius || this._radius;
        L.Path.prototype.setStyle.call(this, options);
        this.setRadius(radius);
        return this;
    },
    toGeoJSON: function () {
        return L.GeoJSON.getFeature(this, {
            type: 'Point',
            coordinates: L.GeoJSON.latLngToCoords(this.getLatLng())
        });
    },

    // private methods
    _project: function () {
        this._point = this._map.latLngToLayerPoint(this._latlng);
        this._updateBounds();
    },
    _updateBounds: function () {
        let r = this._radius;
        let r2 = this._radiusY || r;
        let w = this._clickTolerance();
        let p = [r + w, r2 + w];
        this._pxBounds = new L.Bounds(this._point.subtract(p), this._point.add(p));
    },
    _update: function () {
        if(this._map) this._updatePath();
    },
    _updatePath: function () {
        this._renderer._updateShape(this);
    },
    _empty: function () {
        return this._size && !this._renderer._bounds.intersects(this._pxBounds);
    }
});

// constructor registration
L.cwis.marker = (latlng, options) => {
    return new L.cwis.Marker(latlng, options);
};

// extended svg shapes
L.SVG.include({
    _updateShape: function (layer) {

        // convert shape aliases to base shapes
        /* beautify ignore:start */
        const aliases = {
            // ...polygons...
            'triangle'   : { shape: '3gon'   , rotRad: 0 },
            'triangle-u' : { shape: '3gon'   , rotRad: 0 },
            'triangle-d' : { shape: '3gon'   , rotRad:     Math.PI     },
            'triangle-l' : { shape: '3gon'   , rotRad:     Math.PI / 2 },
            'triangle-r' : { shape: '3gon'   , rotRad: 3 * Math.PI / 2 },
            'square'     : { shape: '4gon'   , rotRad:     Math.PI / 4 },
            'diamond'    : { shape: '4gon'   , rotRad: 0 },
            'pentagon'   : { shape: '5gon'   , rotRad: 0 },
            'hexagon'    : { shape: '6gon'   , rotRad: 0 },
            'heptagon'   : { shape: '7gon'   , rotRad: 0 },
            'octagon'    : { shape: '8gon'   , rotRad:     Math.PI / 8 },
            'nonagon'    : { shape: '9gon'   , rotRad: 0 },
            'decagon'    : { shape: '10gon'  , rotRad: 0 },
            // ...stars...
            'star'       : { shape: '5star'  , rotRad: 0 },
            // ...crosses...
            'cross'      : { shape: '4cross' , rotRad: 0 },
            'plus'       : { shape: '4cross' , rotRad: 0 },
            'x'          : { shape: '4cross' , rotRad:     Math.PI / 4 },
            'asterisk'   : { shape: '6cross' , rotRad: 0 }
        };
        let shape    = layer.options.shape.toLowerCase();
        const alias  = aliases[shape];
        shape        = alias ? alias.shape  : shape;
        const rotRad = alias ? alias.rotRad : 0;
        /* beautify ignore:end */

        // parse base shapes: '#gon', '#star', '#cross'
        let N;
        let isPoly = false;
        let isStar = false;
        let isCross = false;
        let radius = layer._radius;
        if(/^[0-9]+gon$/ui.test(shape)) {
            isPoly = true;
            N = parseFloat(shape);
            radius = 1.3 * radius; // make bigger so look same size as circles
        } else if(/^[0-9]+star$/ui.test(shape)) {
            isStar = true;
            N = 2 * parseFloat(shape);
            radius = 1.6 * radius; // ditto
        } else if(/^[0-9]+cross$/ui.test(shape)) {
            isCross = true;
            N = parseFloat(shape);
        }

        // if shape not recognized set circle
        if(N === undefined) {
            this._updateCircle(layer);
            return;
        }

        // function to get next x-y point
        const userRotRad = -layer.options.rotDeg * Math.PI / 180.0;
        const p = layer._point; // marker center point
        let nextXY = (r, i) => {
            const a = Math.PI - i * 2 * Math.PI / N + rotRad + userRotRad;
            const x = r * Math.sin(a);
            const y = r * Math.cos(a);
            return `${p.x + x},${p.y + y}`;
        };

        // build svg path
        let path = 'M' + nextXY(radius, 0); // svg path to set
        for(let i = 1; i <= N; i++) {
            if(isPoly) {
                // polygon: line to next point
                path += ' L' + nextXY(radius, i);
            } else if(isStar) {
                // star: line to next point with alternating radius
                path += ' L' + nextXY(i % 2 ? 0.35 * radius : radius, i);
            } else if(isCross) {
                // cross: line to center then move to next point
                path += 'L' + p.x + ',' + p.y + 'M' + nextXY(radius, i);
            }
        }

        // set marker svg path
        this._setPath(layer, path);
    }
});


//...........................................
console.log(`[L-cwis] version ${L.cwis.version} loaded and ready`);
//...........................................
