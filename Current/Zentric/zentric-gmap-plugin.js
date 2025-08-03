$(document).ready(function() {
    console.log("jQuery version:", $.fn.jquery);
    console.log("Document is ready.");
    $(".locations-map_wrapper").removeClass("is--show");

    function isMobileDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    }

    // MAPBOX SETUP

    // Replace with your access token
    mapboxgl.accessToken = "pk.eyJ1IjoidHNvaWktd29yayIsImEiOiJjbWR3Ymp3emExMmNoMnFvazB0MXVnaWd3In0.nwyM2N1CcNAveI4YwPCoIg";

    let mapLocations = {
        type: "FeatureCollection",
        features: [],
    };

    // Initialize map
    var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/badexec/clu1r5ru2000h01q53ss8316y',
        center: [-117.1611, 32.7157],
        zoom: 30,
        projection: 'globe'
    });


    let mq = window.matchMedia("(min-width: 480px)");
    if (mq.matches) {
        map.setZoom(6.59);
    } else {
        map.setZoom(6);
    }

    // Add Navigation Control to the map
    map.addControl(new mapboxgl.NavigationControl());

    // Add Geolocate Control to the map
    map.addControl(
        new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true // Enables high-accuracy GPS positioning if available
            },
            trackUserLocation: true, // Continuously updates the device's current location
            showUserHeading: true    // Shows which direction the device is facing
        })
    );

    function getGeoData() {
        let listLocations = document.getElementById("location-list").childNodes;
        listLocations.forEach(function(location, i) {
            let locationLat = location.querySelector("#locationLatitude").value;
            let locationLong = location.querySelector("#locationLongitude").value;
            let locationInfo = location.querySelector(".locations-map_card").innerHTML;
            let locationZip = location.querySelector("#zipCode").value; // Get the zip code
            let coordinates = [locationLong, locationLat];
            let locationID = location.querySelector("#locationID").value;
            let geoData = {
                type: "Feature",
                geometry: { type: "Point", coordinates: coordinates },
                properties: {
                    id: locationID,
                    description: locationInfo,
                    zip: locationZip,  // Store the zip code in the properties
                    arrayID: i,
                },
            };
            if (!mapLocations.features.some(feature => feature.properties.id === geoData.properties.id)) {
                mapLocations.features.push(geoData);
            }
        });
    }
    
    getGeoData();

    // Adds the Geolocation tags for each location and adds a mappoint
    function addMapPoints() {
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

        if (isMobileDevice()) {
            map.on("touchstart", "locations", handleLocationClick);
        } else {
            map.on("click", "locations", handleLocationClick);
        }
    }

    map.on("load", function(e) {
        addMapPoints();
    });

    function handleLocationClick(e) {
        const ID = e.features[0].properties.arrayID;
        addPopup(e);
        $(".locations-map_wrapper").addClass("is--show");
        $(".locations-map_item").removeClass("is--show");
        $(".locations-map_item").eq(ID).addClass("is--show");
    }

    // Global variable to hold the popup reference
    var mapPopup;

    // Adds the popup flag for the selected location.
    function addPopup(e) {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const description = e.features[0].properties.description;

        // Remove the existing popup if there is one
        if (mapPopup) {
            mapPopup.remove();
        }

        // Create a new popup and store the reference
        mapPopup = new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(description)
            .addTo(map);
    }

    // User Zipcode Search Filter Functions
    $('#btn-zipSearch').click(async function() {
        let userZip = $('#input-searchField').val().trim();
        let selectedDistance = parseInt($('#distance-selector').val(), 10); // Get the selected distance from the dropdown

        console.log("Zip code entered:", userZip);
        console.log("Selected distance:", selectedDistance);

        if (userZip) {
            try {
                let userCoords = await zip2coordinates(userZip);
                if (userCoords) {
                    console.log("Coordinates received:", userCoords);
                    updateMapPoints(userCoords.lat, userCoords.long, selectedDistance);
                } else {
                    alert("Unable to find coordinates for the entered ZIP code.");
                }
            } catch (error) {
                console.error("Error during the geocoding process:", error);
                alert("Error during the geocoding process: " + error.message);
            }
        } else {
            alert("Please enter a ZIP code.");
        }
    }); 

    // Filter Clears the selection
    $("#btn-zipClear").click(function() {
        $("#input-searchField").val('');  // Clear the current value
        console.log("Input cleared and map points reset."); // Debug: Confirm reset action
        resetMapPoints();  // Call to reset the map points
    });

    // Converts the users zip code entered to a coordinates set.
    async function zip2coordinates(userZip) {
        const apiKey = mapboxgl.accessToken;
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(userZip)}.json?access_token=${apiKey}`;
    
        console.log("Fetching coordinates from URL:", url);
    
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!response.ok) throw new Error('Failed to fetch coordinates');
            if (data.features.length > 0) {
                const coords = data.features[0].center;
                return { lat: coords[1], long: coords[0] };
            } else {
                console.error('No results found or bad response:', data);
                return null;
            }
        } catch (error) {
            console.error('Error fetching coordinates:', error);
            return null;
        }
    }
    
    // Calculates the Distance from the User Input Zip code to Locations in List
    function calculateDistance(lat1, lon1, lat2, lon2) {
        function toRadians(degrees) {
            return degrees * Math.PI / 180;
        }
    
        var R = 6371; // Radius of the Earth in kilometers
        var dLat = toRadians(lat2 - lat1);
        var dLon = toRadians(lon2 - lon1);
        var a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in kilometers
        return d;
    }

    // Hides the Locations after filtering and changes styles.
    function updateMapPoints(userLat, userLong, maxDistanceInMiles) {
        // Convert miles to kilometers
        const maxDistanceInKilometers = maxDistanceInMiles * 1.60934;
    
        const distances = mapLocations.features.map(feature => {
            let featureLat = feature.geometry.coordinates[1];
            let featureLong = feature.geometry.coordinates[0];
            let distance = calculateDistance(userLat, userLong, featureLat, featureLong);
            return { ...feature, distance: distance };
        });
    
        // Filter features where distance is less than or equal to the converted distance
        const closeFeatures = distances.filter(feature => feature.distance <= maxDistanceInKilometers);
    
        // Sort by distance
        closeFeatures.sort((a, b) => a.distance - b.distance);
    
        if (closeFeatures.length) {
            map.getSource('locations').setData({
                type: 'FeatureCollection',
                features: closeFeatures
            });
        } else {
            console.log('No locations found within close range of ' + maxDistanceInMiles + ' miles.');
            alert("No locations found within close range.");
        }
    }


    // Restore Map points to regular look after pressing X /Clear on filter
    function resetMapPoints() {
        map.getSource('locations').setData(mapLocations); // Reset data to original
        map.setPaintProperty('locations', 'circle-radius', 8);
        map.setPaintProperty('locations', 'circle-color', '#eebe49');
    }    

    // Tab that closes the sidebar for the Location Card Shown
    $(".close-block").click(function() {
        $(".locations-map_wrapper").removeClass("is--show");
        
        // Close and remove the popup if it exists
        if (mapPopup) {
            mapPopup.remove();
        }
    });

    // Hover functionality to change cursor style as a UI indicator
    const hoverPopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
    });

    map.on('mouseenter', 'locations', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        hoverPopup.setLngLat(e.features[0].geometry.coordinates.slice()).setHTML(e.features[0].properties.description).addTo(map);
    });

    map.on('mouseleave', 'locations', () => {
        map.getCanvas().style.cursor = '';
        hoverPopup.remove();
    });
});