class Cartogram {
    /**
     * Class constructor with basic chart configuration
     * @param {Object}
     * @param {Array}
     */
    constructor(_config, _dispatcher, _data, _states) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            colorScale: _config.colorScale,
            containerWidth: _config.containerWidth,
            containerHeight: _config.containerHeight,
            margin: { top: 50, right: 25, bottom: 40, left: 50 },
            legendWidth: 150,
            legendHeight: 250,
            tooltipPadding: _config.tooltipPadding || 16,
        }
        this.states = _states
        this.stateNames = _states.map((d) => d.name)
        this.dispatcher = _dispatcher
        this.state = null
        this.data = _data
        this.year = '1985'
        this.initVis()
    }

    /**
     * Initialize scales/axes and append static elements, such as axis titles
     */
    initVis() {
        let vis = this

        vis.map = d3.select(this.config.parentElement)

        vis.abbreviationDictionary = {}
        vis.states.forEach((s) => {
            vis.abbreviationDictionary[s.name] = s.abbreviation
        })

        // helpers
        vis.rebuildData = (data) => {
            return data
                .flat()
                .flat()
                .flat()
                .flat()
                .flat()
                .flat()
                .filter((d) => typeof d !== 'string')
        }

        vis.formatTradedPlayers = (player) => {
            const teams = player[1]
            if (teams.length > 1) {
                let teamsPlayed = []
                for (let i = 1; i <= teams.length; i++) {
                    teamsPlayed.push(teams.pop()[0])
                }
                vis.getPlayerDataFromTeam(teams).teams_played = teamsPlayed
            }
        }

        vis.groupByStates = (data) => {
            return d3.group(
                data,
                (d) => d.Year,
                (d) => d.birth_state
            )
        }

        let selector = document.getElementById('year-slider')
        let label = document.querySelector('.year-slider-label')

        label.innerHTML = `${vis.year}`

        selector.addEventListener('input', function (event) {
            if (selector.value) {
                let selectedYear = selector.value

                label.innerHTML = `${selectedYear}`
                vis.year = selectedYear

                vis.updateVis(selectedYear)
                const selectedData = {
                    state: vis.state,
                    year: vis.year,
                    data: vis.yearData.get(vis.state) || [],
                }

                vis.dispatcher.call('selectStateAndYear', event, selectedData)
            }
        })

        // from colorBrewer
        vis.colorRange = [
            '#fff7f3',
            '#fde0dd',
            '#fcc5c0',
            '#fa9fb5',
            '#f768a1',
            '#dd3497',
            '#ae017e',
            '#7a0177',
        ]

        vis.colorScale = d3.scaleQuantile().range(vis.colorRange)

        // let's add the legend
        // reference https://bl.ocks.org/zanarmstrong/0b6276e033142ce95f7f374e20f1c1a7
        vis.svg = d3
            .select('svg')
            .attr('width', vis.config.legendWidth)
            .attr('height', vis.config.legendHeight)

        vis.svg
            .append('g')
            .attr('class', 'legendQuant')
            .attr('transform', 'translate(0,20)')

        vis.legend = d3
            .legendColor()
            .labelFormat(d3.format('.0d'))
            .title('NBA Players')
            .titleWidth(200)
            .scale(vis.colorScale)
    }

    updateVis(selectedYear) {
        let vis = this

        vis.getState = (d) => d[0]
        vis.getPlayersArray = (d) => d[1]

        vis.getYear = (d) => d[0]
        vis.getPlayerDataFromTeam = (d) => d[0][1][0]

        vis.playerData = vis.data.players.filter(
            (d) => vis.getYear(d) === (selectedYear || vis.year)
        )

        vis.playerData[0][1].forEach((player) => {
            vis.formatTradedPlayers(player)
        })

        vis.playerData = vis.rebuildData(vis.playerData)

        vis.yearData = vis
            .groupByStates(vis.playerData)
            .get(selectedYear || vis.year)

        const internationalPlayers = []

        // find non-US and Canadian born players
        vis.yearData.forEach((players, state) => {
            if (!vis.stateNames.includes(state)) {
                internationalPlayers.push(vis.yearData.get(state))
                vis.yearData.delete(state)
            }
        })

        vis.yearData.set(
            'International',
            internationalPlayers.flat().length > 0
                ? internationalPlayers.flat()
                : null
        )

        vis.playerStateYearArray = Array.from(vis.yearData)

        const stateKeysArray = vis.playerStateYearArray.map((d) =>
            vis.getState(d)
        )

        // find US states missing from dataset
        const missingStates = vis.stateNames.filter(
            (a) => !stateKeysArray.includes(a)
        )

        // and push them with no player data so we can render the map
        missingStates.forEach((missingState) => {
            vis.playerStateYearArray.push([missingState, null])
        })

        let count = []

        vis.playerStateYearArray.forEach((state) => {
            if (vis.getPlayersArray(state)) {
                count.push(vis.getPlayersArray(state).length)
            }
        })

        vis.colorScale.domain([1, d3.max(count)])
        vis.renderVis()
    }

    /**
     * Bind data to visual elements
     */
    renderVis() {
        let vis = this

        vis.map
            .selectAll('div')
            .data(vis.playerStateYearArray)
            .join('div')
            .text((d) => vis.abbreviationDictionary[vis.getState(d)])
            .attr('class', 'state')
            .attr('data-born-state', (d) => vis.getState(d))
            .style('background-color', (d) =>
                vis.getPlayersArray(d)
                    ? vis.colorScale(vis.getPlayersArray(d).length)
                    : ''
            )
            .classed('state--active', (d) => vis.getState(d) === vis.state)
            .style('color', (d) => {
                if (vis.getPlayersArray(d)) {
                    if (
                        vis.colorScale(vis.getPlayersArray(d).length) ===
                            vis.colorRange[7] ||
                        vis.colorScale(vis.getPlayersArray(d).length) ===
                            vis.colorRange[6]
                    ) {
                        return 'white'
                    }
                }
            })

        vis.map.selectAll('.state').on('click', function (event, d) {
            const isActive = d3.select(this).classed('state--active')
            // clear all the other active states
            vis.map.selectAll('.state').classed('state--active', false)

            d3.select(this).classed('state--active', !isActive)

            // if it was active previously, and we click it then it should reset the state
            if (isActive) {
                vis.state = null
            } else {
                vis.state = vis.getState(d)
            }

            const selectedData = {
                state: vis.state,
                year: vis.year,
                data: vis.yearData.get(vis.state) || [],
            }

            vis.dispatcher.call('selectStateAndYear', event, selectedData)
        })

        d3.select('#year-slider').on('input', function (event, d) {
            const stateAndYear = {
                state: vis.state,
                year: vis.year,
            }
            vis.dispatcher.call('selectStateAndYear', event, stateAndYear)
        })

        vis.map
            .selectAll('.state')
            .on('mouseover', (event, d) => {
                d3.select('#tooltip').style('display', 'block').html(`
                    <h4>${d[0]}</h4>
                    <span><strong>${
                        vis.getPlayersArray(d)
                            ? vis.getPlayersArray(d).length
                            : 0
                    }</strong> NBA players</span>
              `)
            })
            .on('mousemove', (event) => {
                d3.select('#tooltip')
                    .style(
                        'left',
                        event.pageX + vis.config.tooltipPadding + 'px'
                    )
                    .style(
                        'top',
                        event.pageY + vis.config.tooltipPadding + 'px'
                    )
            })
            .on('mouseleave', () => {
                d3.select('#tooltip').style('display', 'none')
            })

        vis.svg.select('.legendQuant').call(vis.legend)
    }
}
