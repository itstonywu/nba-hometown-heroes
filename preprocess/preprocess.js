const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const fs = require('fs'); 
const parse = require('csv-parse');

var apiKey = "APIKEYHERE"

var collegeSet = new Set()
var hometownSet = new Set()
var teamSet = new Set()
var teamCitySet = new Set()

/**
 * How I made promises and waited for all the XHR requests to return before exporting all the data
 * https://stackoverflow.com/questions/30008114/how-do-i-promisify-native-xhr
 */ 
 function makeRequest (method, url, location) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
            resolve({
                location: location,
                apiResponse: xhr.responseText
            });
        } else {
            reject({
                location: location,
                status: this.status,
                statusText: xhr.statusText
            });
        }
      };
      xhr.onerror = function () {
        reject({
            location: location,
            status: this.status,
            statusText: xhr.statusText
        });
      };
      xhr.send();
    });
}

function retryFailedHometowns(currentHometownJsonobj, failedLocations) {
    var failedLocationPromises = []
    var newFailedLocations = []

    console.log("Retrying failed locations")
    console.log(failedLocations)

    failedLocations.forEach((location) => {
        var locationstring = location.split(' ').join('+')
        var queryLink = "https://maps.googleapis.com/maps/api/geocode/json?address=" + locationstring + "&key=" + apiKey

        failedLocationPromises.push(makeRequest("GET", queryLink, location))
    })

    Promise.allSettled(failedLocationPromises).then((values) => {
        values.forEach((value) => {
            var results = {}
            if (value.status == "fulfilled") {
                results.hometown = value.value.location
                
                var api_response = JSON.parse(value.value.apiResponse)
                if (api_response.status == 'OK' || api_response.status == 'ZERO_RESULTS') {
                    results.locationData = api_response.results[0]
            
                    currentHometownJsonobj.push(results)
                } else {
                    newFailedLocations.push(value.value.location)
                }
                
            } else {
                newFailedLocations.push(value.reason.location)
            }
        })

        if (newFailedLocations.length > 0) {
            retryFailedHometowns(currentHometownJsonobj, newFailedLocations)
        } else {
            var data = JSON.stringify(currentHometownJsonobj, undefined, 2)
            fs.writeFileSync('hometown_locations.json', data);
        }
    })
}


/**
 * Code used to read CSV file
 * https://stackoverflow.com/questions/23080413/parsing-a-csv-file-using-nodejs
 */
fs.createReadStream("nba_data_joined.csv")
    .pipe(parse({ quote: '"', ltrim: true, rtrim: true, delimiter: ',' }))
    .on('data', function(csvrow) {
        var college = csvrow[54]
        var cityState = csvrow[56] + " " + csvrow[57]
        var team = csvrow[6]

        cityState = cityState.replace( /\s\s+/g, ' ' )

        if (college.length > 1 && college != "college") {
            collegeSet.add(college)
        }

        
        if (cityState.length > 2 && cityState != "birth_city birth_state") {
            hometownSet.add(cityState)
        }

        if (team.length > 1 && team != "Tm") {
            teamSet.add(team)
        }
     
    })
    .on('end',function() {
        var colleges = Array.from(collegeSet)
        var hometowns = Array.from(hometownSet)
        var teams = Array.from(teamSet)

        var collegePromises = []
        var hometownPromises = []
        var teamPromises = []

        
        colleges.forEach((college) => {
            var location = college.split(' ').join('+')
            var queryLink = "https://maps.googleapis.com/maps/api/geocode/json?address=" + location + "&key=" + apiKey

            collegePromises.push(makeRequest("GET", queryLink, college))
        })
        
        hometowns.forEach((hometown) => {
            var location = hometown.split(' ').join('+')
            var queryLink = "https://maps.googleapis.com/maps/api/geocode/json?address=" + location + "&key=" + apiKey

            hometownPromises.push(makeRequest("GET", queryLink, hometown))
        })     

        Promise.all(collegePromises).then((values) => {
            var allCollegeInfo = []

            values.forEach((value) => {
                var results = {}

                results.college = value.location
                results.locationData = JSON.parse(value.apiResponse).results[0] 
                
                allCollegeInfo.push(results)
            })

            var data = JSON.stringify(allCollegeInfo, undefined, 2)
            //fs.writeFileSync('college_locations.json', data);
        })
    
        // Seems like we send too many requests all at once, we will have to see which cities
        // Don't have an associated location data.
        Promise.allSettled(hometownPromises).then((values) => {
            var allHometownInfo = []
            var failedLocations = []

            values.forEach((value) => {
                var results = {}
                if (value.status == "fulfilled") {
                    results.hometown = value.value.location

                    var api_response = JSON.parse(value.value.apiResponse)
                    if (api_response.status == 'OK') {
                        results.locationData = api_response.results[0]
                
                        allHometownInfo.push(results)
                    } else {
                        failedLocations.push(value.value.location)
                    }
                } else {
                    failedLocations.push(value.reason.location)
                }
            })
           
            if (failedLocations.length > 0) {
                console.log("Not all requests has passed, retrying failed requests")
                retryFailedHometowns(allHometownInfo, failedLocations)
            } else {
                var data = JSON.stringify(allHometownInfo, undefined, 2)
                fs.writeFileSync('hometown_locations.json', data);
            }
        })
    });

/**
 * Code used to read CSV file
 * https://stackoverflow.com/questions/23080413/parsing-a-csv-file-using-nodejs
 */
fs.createReadStream("teams-location.csv")
.pipe(parse({ quote: '"', ltrim: true, rtrim: true, delimiter: ',' }))
.on('data', function(csvrow) {
    var teamCity1 = csvrow[2]
    var teamState1 = csvrow[3]
    var cityState1 = teamCity1 + " " + teamState1

    cityState1 = cityState1.replace( /\s\s+/g, ' ' )
    
    var teamCity2 = csvrow[4]
    var teamState2 = csvrow[5]
    var cityState2 = teamCity2 + " " + teamState2

    cityState2 = cityState2.replace( /\s\s+/g, ' ' )

    if (cityState1.length > 2 && cityState1 != "city state") {
        teamCitySet.add(cityState1)
    }

    if (cityState2.length > 2 && cityState2 != "city2 state2") {
        teamCitySet.add(cityState2)
    }
})
.on('end',function() {
    var teamCities = Array.from(teamCitySet)

    var teamCityPromises = []
    
    teamCities.forEach((teamCity) => {
        var location = teamCity.split(' ').join('+')
        var queryLink = "https://maps.googleapis.com/maps/api/geocode/json?address=" + location + "&key=" + apiKey
        teamCityPromises.push(makeRequest("GET", queryLink, teamCity))
    })  

    Promise.all(teamCityPromises).then((values) => {
        var allTeamCityInfo = []

        values.forEach((value) => {
            var results = {}

            results.teamCity = value.location
            results.locationData = JSON.parse(value.apiResponse).results[0] 
            
            allTeamCityInfo.push(results)
        })

        var data = JSON.stringify(allTeamCityInfo, undefined, 2)
        fs.writeFileSync('team_city_locations.json', data);
    })
});
