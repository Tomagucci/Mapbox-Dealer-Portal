$(document).ready(function () {
    console.log("jQuery version:", $.fn.jquery);
    console.log("Document is ready.");
    $(".locations-map_wrapper").removeClass("is--show");

    function isMobileDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    }

    // MAPBOX SETUP
    mapboxgl.accessToken = "pk.eyJ1IjoiYmFkZXhlYyIsImEiOiJjbHR6ejNxZm8wNTlmMmpsb21meW9tcWxpIn0.hPrtQWtl6vIeQWekmLWexQ";

    let mapLocations = {
        type: "FeatureCollection",
        features: [],
    };

    var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/badexec/clu1r5ru2000h01q53ss8316y',
        center: [-117.1611, 32.7157], // San Diego
        zoom: 8, // Much more realistic
        projection: 'globe'
    });

    let mq = window.matchMedia("(min-width: 480px)");
    map.setZoom(mq.matches ? 6.59 : 6);

    map.addControl(new mapboxgl.NavigationControl());
    map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true
    }));

    function getGeoData() {
        let listLocations = document.getElementById("Stores-list").children;

        Array.from(listLocations).forEach(function (location, i) {
            let locationLat = location.querySelector("#locationLatitude")?.value.trim();
            let locationLong = location.querySelector("#locationLongitude")?.value.trim();
            let locationInfo = location.querySelector(".locations-map_card")?.innerHTML;
            let locationZip = location.querySelector("#zipCode")?.value.trim();
            let locationID = location.querySelector("#locationID")?.value.trim();

            if (!locationLat || !locationLong) return;

            let coordinates = [parseFloat(locationLong), parseFloat(locationLat)];

            let geoData = {
                type: "Feature",
                geometry: { type: "Point", coordinates },
                properties: {
                    id: locationID,
                    description: locationInfo,
                    zip: locationZip,
                    arrayID: i,
                },
            };

            if (!mapLocations.features.some(feature => feature.properties.id === geoData.properties.id)) {
                mapLocations.features.push(geoData);
            }
        });

        console.log("Loaded store locations:", mapLocations.features);
    }

    function addMapPoints() {
        if (map.getLayer("locations")) return;

        map.addLayer({
            id: "locations",
            type: "circle",
            source: {
                type: "geojson",
                data: mapLocations,
            },
            paint: {
                "circle-radius": 8,
                "circle-stroke-width": 1,
                "circle-color": "#eebe49",
                "circle-opacity": 1,
                "circle-stroke-color": "#eebe49",
            },
        });

        const clickEvent = isMobileDevice() ? "touchstart" : "click";
        map.on(clickEvent, "locations", handleLocationClick);
    }

    map.on("load", function () {
        getGeoData();
        addMapPoints();
    });

    function handleLocationClick(e) {
        const ID = e.features[0].properties.arrayID;
        addPopup(e);
        $(".locations-map_wrapper").addClass("is--show");
        $(".locations-map_item").removeClass("is--show");
        $(".locations-map_item").eq(ID).addClass("is--show");
    }

    let mapPopup;
    function addPopup(e) {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const description = e.features[0].properties.description;

        if (mapPopup) mapPopup.remove();

        mapPopup = new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(description)
            .addTo(map);
    }

    $('#btn-zipSearch').click(async function () {
        let userZip = $('#input-searchField').val().trim();
        let selectedDistance = parseInt($('#distance-selector').val(), 10);

        if (userZip) {
            try {
                let userCoords = await zip2coordinates(userZip);
                if (userCoords) {
                    updateMapPoints(userCoords.lat, userCoords.long, selectedDistance);
                } else {
                    alert("Unable to find coordinates for the entered ZIP code.");
                }
            } catch (error) {
                console.error("Error during geocoding:", error);
                alert("Geocoding error: " + error.message);
            }
        } else {
            alert("Please enter a ZIP code.");
        }
    });

    $("#btn-zipClear").click(function () {
        $("#input-searchField").val('');
        resetMapPoints();
    });

    async function zip2coordinates(userZip) {
        const apiKey = mapboxgl.accessToken;
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(userZip)}.json?access_token=${apiKey}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.features.length > 0) {
                const coords = data.features[0].center;
                return { lat: coords[1], long: coords[0] };
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error fetching coordinates:', error);
            return null;
        }
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        function toRadians(degrees) {
            return degrees * Math.PI / 180;
        }

        const R = 6371;
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
                  Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function updateMapPoints(userLat, userLong, maxDistanceInMiles) {
        const maxDistanceKm = maxDistanceInMiles * 1.60934;
        const distances = mapLocations.features.map(feature => {
            const featureLat = feature.geometry.coordinates[1];
            const featureLong = feature.geometry.coordinates[0];
            const distance = calculateDistance(userLat, userLong, featureLat, featureLong);
            return { ...feature, distance };
        });

        const closeFeatures = distances.filter(f => f.distance <= maxDistanceKm);
        closeFeatures.sort((a, b) => a.distance - b.distance);

        if (closeFeatures.length) {
            map.getSource("locations").setData({
                type: "FeatureCollection",
                features: closeFeatures
            });
        } else {
            alert("No locations found within the selected range.");
        }
    }

    function resetMapPoints() {
        map.getSource('locations').setData(mapLocations);
        map.setPaintProperty('locations', 'circle-radius', 8);
        map.setPaintProperty('locations', 'circle-color', '#eebe49');
    }

    $(".close-block").click(function () {
        $(".locations-map_wrapper").removeClass("is--show");
        if (mapPopup) mapPopup.remove();
    });

    const hoverPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });

    map.on('mouseenter', 'locations', e => {
        map.getCanvas().style.cursor = 'pointer';
        hoverPopup.setLngLat(e.features[0].geometry.coordinates.slice())
            .setHTML(e.features[0].properties.description)
            .addTo(map);
    });

    map.on('mouseleave', 'locations', () => {
        map.getCanvas().style.cursor = '';
        hoverPopup.remove();
    });
});
