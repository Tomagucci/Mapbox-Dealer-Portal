$(document).ready(function() {
    console.log("Document is ready.");
    $(".locations-map_wrapper").removeClass("is--show");

    function isMobileDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    }

    // MAPBOX SETUP
    mapboxgl.accessToken = "pk.eyJ1IjoiYmFkZXhlYyIsImEiOiJjbHR6ejNxZm8wNTlmMmpsb21meW9tcWxpIn0.hPrtQWtl6vIeQWekmLWexQ";
    let mapLocations = {
        type: "FeatureCollection",
        features: []
    };

    var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/badexec/clu1r5ru2000h01q53ss8316y',
        center: [-74.657884, 39.719790],
        zoom: 30,
        projection: 'globe'
    });

    let mq = window.matchMedia("(min-width: 480px)");
    mq.matches ? map.setZoom(6.59) : map.setZoom(6);

    map.addControl(new mapboxgl.NavigationControl());
    map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true
    }));

    function getGeoData() {
        document.getElementById("location-list").childNodes.forEach((location, i) => {
            let geoData = {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [location.querySelector("#locationLongitude").value, location.querySelector("#locationLatitude").value]
                },
                properties: {
                    id: location.querySelector("#locationID").value,
                    description: location.querySelector(".locations-map_card").innerHTML,
                    zip: location.querySelector("#zipCode").value,
                    arrayID: i
                }
            };
            if (!mapLocations.features.some(feature => feature.properties.id === geoData.properties.id)) {
                mapLocations.features.push(geoData);
            }
        });
    }

    getGeoData();

    function addMapPoints() {
        map.addLayer({
            id: "locations",
            type: "circle",
            source: { type: "geojson", data: mapLocations },
            paint: {
                "circle-radius": 8,
                "circle-stroke-width": 1,
                "circle-color": "#eebe49",
                "circle-opacity": 1,
                "circle-stroke-color": "#eebe49"
            }
        });

        if (isMobileDevice()) {
            map.on("touchstart", "locations", handleLocationClick);
        } else {
            map.on("click", "locations", handleLocationClick);
        }
    }

    map.on("load", addMapPoints);

    function handleLocationClick(e) {
        const ID = e.features[0].properties.arrayID;
        addPopup(e);
        $(".locations-map_wrapper").addClass("is--show");
        $(".locations-map_item").removeClass("is--show");
        $(".locations-map_item").eq(ID).addClass("is--show");
    }

    function addPopup(e) {
        new mapboxgl.Popup().setLngLat(e.features[0].geometry.coordinates.slice()).setHTML(e.features[0].properties.description).addTo(map);
    }

    // Debounce function to reduce frequency of API calls
    function debounce(func, wait, immediate) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (immediate && !timeout) func.apply(context, args);
        };
    }

    var executeSearch = debounce(function() {
        let userZip = $('#input-searchField').val().trim();
        if (!userZip) {
            alert('Please enter a zip code.');
            return;
        }

        if (!/^\d{5}(-\d{4})?$/.test(userZip)) {  // US zip codes
            alert('Please enter a valid zip code.');
            return;
        }

        $('#btn-zipSearch').text('Searching...').prop('disabled', true);

        getUserLatLonByZip(userZip, function(coords) {
            $('#btn-zipSearch').text('Search').prop('disabled', false);
            if (coords) {
                updateMapPoints(coords.lat, coords.lon, $('#distance-selector').val());
            } else {
                alert('Failed to get location for zip code: ' + userZip);
            }
        });
    }, 250);

    $('#btn-zipSearch').click(executeSearch);

    function getUserLatLonByZip(zip, callback) {
        var url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(zip)}.json?access_token=${mapboxgl.accessToken}`;
        $.getJSON(url, function(data) {
            if (data.features && data.features.length > 0) {
                var coordinates = data.features[0].geometry.coordinates;
                callback({ lon: coordinates[0], lat: coordinates[1] });
            } else {
                alert('No valid location found for this zip code. Please check the zip code and try again.');
                callback(null);
            }
        }).fail(function() {
            alert("Error accessing Mapbox Geocoding API. Please try again later.");
            callback(null);
        });
    }

    function updateMapPoints(lat, lon, selectedDistance) {
        let distanceInKm = parseFloat(selectedDistance) * 1.60934;
        const relevantFeatures = mapLocations.features.filter(feature => {
            let distance = getDistanceFromLatLonInKm(lat, lon, feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
            return distance <= distanceInKm;
        });

        if (relevantFeatures.length) {
            map.getSource('locations').setData({
                type: 'FeatureCollection',
                features: relevantFeatures
            });
            map.setPaintProperty('locations', 'circle-color', '#ffffff');
        } else {
            alert("No locations found within this distance of " + selectedDistance + " miles.");
        }
    }

    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        var R = 6371;  // Radius of the earth in kilometers
        var dLat = deg2rad(lat2 - lat1);
        var dLon = deg2rad(lon2 - lon1);
        var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    function deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    $("#btn-zipClear").click(function() {
        $("#input-searchField").val('');
        $("#input-searchField").attr('placeholder', 'Enter Zip Code');
        resetMapPoints();
    });

    function resetMapPoints() {
        map.getSource('locations').setData(mapLocations);
        map.setPaintProperty('locations', 'circle-radius', 8);
        map.setPaintProperty('locations', 'circle-color', '#eebe49');
    }

    $(".close-block").click(function() {
        $(".locations-map_wrapper").removeClass("is--show");
    });

    const hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });
    map.on('mouseenter', 'locations', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        hoverPopup.setLngLat(e.features[0].geometry.coordinates.slice()).setHTML(e.features[0].properties.description).addTo(map);
    });

    map.on('mouseleave', 'locations', () => {
        map.getCanvas().style.cursor = '';
        hoverPopup.remove();
    });
});