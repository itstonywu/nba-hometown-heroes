/**
 * Load data from CSV file asynchronously and render charts
 */
let data, bubbleChart, careerMap, cartogram, collegeGraph

let worldMapData, rolledPlayerData, groupedByStateData, groupedByPlayerIDData

let selectedState, selectedPlayer, selectedYear

// All the location data, and also some text data
let team_dictionary, hometown_dictionary, college_dictionary

// Temporary dispatcher TODO: Replace this
const dispatcher = d3.dispatch('tempDispatch')

const stateDispatcher = d3.dispatch('selectStateAndYear')
const playerDispatcher = d3.dispatch('selectPlayer', 'deselectPlayer')

const filesToLoad = [
    'nba_data_joined.csv',
    'teams-location.csv',
    'team_city_locations.json',
    'hometown_locations.json',
    'college_locations.json',
    'countries-50m.json',
    'states_titlecase.json',
]

let dataPromises = []

filesToLoad.forEach((file) => {
    if (file.split('.')[1] === 'csv') {
        dataPromises.push(d3.csv(`data/${file}`))
    } else {
        dataPromises.push(d3.json(`data/${file}`))
    }
})

Promise.all(dataPromises).then((values) => {
    // Data read from data files
    let _nba_data = values[0]
    let _team_data = values[1]
    let _team_location_data = values[2]
    let _hometown_location_data = values[3]
    let _college_location_data = values[4]
    let _world_map_data = values[5]
    let _states = values[6]

    // filter out players without birth states
    data = _nba_data.filter((d) => d.birth_state !== '')
    groupedByPlayerIDData = d3.groups(
        data,
        (d) => d.Year,
        (d) => d.player_id,
        (d) => d.Tm
    )

    worldMapData = _world_map_data

    team_dictionary = {}
    hometown_dictionary = {}
    college_dictionary = {}

    // Creates a dictionary indexed on team abbreviations containing an object
    // Filled with relevant data for the team
    _team_data.forEach((team) => {
        let cityStateKey = team.city + ' ' + team.state
        cityStateKey = cityStateKey.replace(/\s\s+/g, ' ')

        let locationEntry = _team_location_data.find(
            (element) => element.teamCity == cityStateKey
        )

        teamInformation = {}

        teamInformation.display_name = team.team
        teamInformation.display_city = team.city + ', ' + team.state
        teamInformation.lat = locationEntry.locationData.geometry.location.lat
        teamInformation.long = locationEntry.locationData.geometry.location.lng

        team_dictionary[team.key] = teamInformation
    })

    _hometown_location_data.forEach((hometown) => {
        hometownInformation = {}

        hometownInformation.lat = hometown.locationData.geometry.location.lat
        hometownInformation.long = hometown.locationData.geometry.location.lng

        hometown_dictionary[hometown.hometown] = hometownInformation
    })

    _college_location_data.forEach((college) => {
        collegeInformation = {}

        let college_city = college.locationData.address_components.find(
            (element) => {
                return (
                    element.types.includes('locality') ||
                    element.types.includes('sublocality') ||
                    element.types.includes('administrative_area_level_3') ||
                    element.types.includes('administrative_area_level_2') ||
                    element.types.includes('neighborhood')
                )
            }
        )

        let college_state = college.locationData.address_components.find(
            (element) => {
                return element.types.includes('administrative_area_level_1')
            }
        )

        let display_city =
            (college_city === undefined ? '' : college_city.long_name + ', ') +
            college_state.long_name

        collegeInformation.display_name = college.college
        collegeInformation.display_city = display_city
        collegeInformation.lat = college.locationData.geometry.location.lat
        collegeInformation.long = college.locationData.geometry.location.lng

        college_dictionary[college.college] = collegeInformation
    })

    rolledPlayerData = d3.groups(
        d3.filter(data, (d) => d.Tm != 'TOT'),
        (d) => d.player_id
    )

    // Append entries from same team into same entry so there are no multiple redraws of points
    rolledPlayerData.forEach((d) => {
        let newArr = []

        newArr.push(d[1][0])
        newArr[0].teamStartYear = +d[1][0].Year
        newArr[0].teamEndYear = +d[1][0].Year + 1

        for (let i = 1; i < d[1].length; i++) {
            if (d[1][i].Tm == newArr[newArr.length - 1].Tm) {
                newArr[newArr.length - 1].teamEndYear = +d[1][i].Year + 1
            } else {
                newArr.push(d[1][i])
                newArr[newArr.length - 1].teamStartYear = +d[1][i].Year
                newArr[newArr.length - 1].teamEndYear = +d[1][i].Year + 1
            }
        }

        d[1] = newArr
    })

    // Initialize all the visualizations
    bubbleChart = new BubbleChart(
        {
            parentElement: '#stats-vis',
        },
        playerDispatcher,
        data
    )
    bubbleChart.updateVis(null, 'PTS', '1986')

    careerMap = new CareerMap(
        {
            parentElement: '#career-vis',
            listElement: '.career__list',
        },
        dispatcher,
        worldMapData,
        rolledPlayerData,
        {
            hometown: hometown_dictionary,
            team: team_dictionary,
            college: college_dictionary,
        }
    )
    careerMap.updateVis()

    cartogram = new Cartogram(
        {
            parentElement: '#cartogram-vis',
        },
        stateDispatcher,
        { players: groupedByPlayerIDData },
        _states
    )
    cartogram.updateVis()

    collegeGraph = new CollegeGraph(
        {
            parentElement: '#college-vis',
        },
        dispatcher,
        data
    )
    collegeGraph.updateVis(-1)
})

const statsSection = d3.select('.section--stats')
const collegeSection = d3.select('.section--college')
const careerSection = d3.select('.section--career')
const playerStats = d3.select('.stats__player')

const footer = d3.select('footer')
const ctaState = d3.select('.cta--state')
const ctaPlayer = d3.select('.cta--player')

statsSection.classed('section--hide', true)
collegeSection.classed('section--hide', true)
careerSection.classed('section--hide', true)
playerStats.classed('section--hide', true)
footer.classed('section--hide', true)

ctaState.classed('cta--hidden', false)
ctaPlayer.classed('cta--hidden', false)

stateDispatcher.on('selectStateAndYear', (s) => {
    bubbleChart.clearPlayerSelected()

    if (s.state !== null && s.state !== '') {
        statsSection.classed('section--hide', false)
        ctaState.classed('cta--hidden', true)
        document.getElementById('bc-state-title').innerHTML = `${s.state}`
    } else {
        document.getElementById('bc-state-title').innerHTML = `Average`
        ctaState.classed('cta--hidden', false)
        statsSection.classed('section--hide', true)
    }

    bubbleChart.data = s.data
    bubbleChart.updateVis(s.state, bubbleChart.selectedStat, s.year)
})

playerDispatcher.on('selectPlayer', (s) => {
    document.getElementById(
        'bc-player-title'
    ).innerHTML = `${s.name} - ${s.position}`
    document.getElementById(
        'cm-player-title'
    ).innerHTML = `The NBA Journey of ${s.name}`

    collegeSection.classed('section--hide', false)
    careerSection.classed('section--hide', false)
    playerStats.classed('section--hide', false)
    footer.classed('section--hide', false)

    ctaPlayer.classed('cta--hidden', true)

    collegeGraph.updateVis(s.player_id)

    careerMap.selectedPlayers = [s.player_id]
    careerMap.updateVis()

    careerMap.zoomIn()
})

playerDispatcher.on('deselectPlayer', (s) => {
    document.getElementById('bc-player-title').innerHTML = `NBA Player`
    document.getElementById('cm-player-title').innerHTML = `The NBA Journey`

    collegeSection.classed('section--hide', true)
    careerSection.classed('section--hide', true)
    playerStats.classed('section--hide', true)
    footer.classed('section--hide', true)

    ctaPlayer.classed('cta--hidden', false)

    collegeGraph.resetView()

    careerMap.selectedPlayers = []
    careerMap.updateVis()

    careerMap.zoomOut()
})
