class BubbleChart {
    /**
     * Class constructor with basic chart configuration
     * @param {Object}
     * @param {Array}
     */
    constructor(_config, _dispatcher, _data) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement || '#stats-vis',
            colorScale: _config.colorScale,
            containerWidth: _config.containerWidth || 700,
            containerHeight: _config.containerHeight || 700,
            margin: { top: 100, right: 25, bottom: 200, left: 50 },
        }
        this.masterData = _data
        this.data = null
        this.selectedStat = 'PTS'
        this.selectedState = ''
        this.selectedYear = '1986'
        this.selectedPosition = null
        this.selectedNode = null
        this.dispatcher = _dispatcher
        this.initVis()
    }

    /**
     * Initialize scales/axes and append static elements, such as axis titles
     */
    initVis() {
        let vis = this

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.width =
            vis.config.containerWidth -
            vis.config.margin.left -
            vis.config.margin.right
        vis.height =
            vis.config.containerHeight -
            vis.config.margin.top -
            vis.config.margin.bottom

        // Define size of SVG drawing area
        vis.svg = d3
            .select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight)

        // Append group element that will contain our actual chart
        // and position it according to the given margin config
        vis.chartArea = vis.svg
            .append('g')
            .attr(
                'transform',
                `translate(${vis.config.margin.left},${vis.config.margin.top})`
            )

        // Locations to move bubbles towards
        vis.center = {
            x: vis.width / 2 + vis.config.margin.left,
            y: vis.height / 2 + vis.config.margin.top,
        }

        // strength to apply to the position forces
        vis.forceStrength = 0.05

        vis.bubbles = null
        vis.nodes = []

        vis.charge = function (d) {
            return -Math.pow(d.radius, 2.2) * vis.forceStrength
        }

        vis.setNode = function () {
            vis.bubbles
                .attr('cx', function (d) {
                    return d.x
                })
                .attr('cy', function (d) {
                    return d.y
                })
        }

        vis.simulation = d3
            .forceSimulation()
            .velocityDecay(0.2)
            .force('x', d3.forceX().strength(vis.forceStrength).x(vis.center.x))
            .force('y', d3.forceY().strength(vis.forceStrength).y(vis.center.y))
            .force('charge', d3.forceManyBody().strength(vis.charge))
            .on('tick', vis.setNode)

        vis.simulation.stop()

        vis.createNodes = function (rawData, stat) {
            // Use the max and min of data to provide domain of scale depending on selected stat
            let maxAmount = d3.max(rawData, function (d) {
                return +d[stat]
            })
            let minAmount = d3.min(rawData, function (d) {
                return +d[stat]
            })

            // Sizes bubbles based on area. Use square root scale
            let radiusScale = d3
                .scalePow()
                .exponent(0.5)
                .range([4, 30])
                .domain([minAmount, maxAmount])

            // Use map() to convert raw data into node data.
            let myNodes = rawData.map(function (d) {
                return {
                    id: d.id,
                    player_id: d.player_id,
                    radius: radiusScale(+d[stat]),
                    value: +d[stat],
                    name: d.Player.replace(/\*$/, ''),
                    age: d.Age,
                    hof: d.Player.includes('*') ? true : false,
                    height: d.height,
                    weight: d.weight,
                    position: vis.getPrimaryPosition(d),
                    x: Math.random() * vis.width,
                    y: Math.random() * vis.height,
                }
            })

            // sort them to prevent occlusion of smaller nodes.
            myNodes.sort(function (a, b) {
                return b.value - a.value
            })

            return myNodes
        }

        // Possible stats we can change bubble chart bassed off of
        vis.possibleStats = [
            'G',
            'MP',
            'FGA',
            'FG%',
            '3P%',
            '3PA',
            'FTA',
            'FT%',
            'TRB',
            'AST',
            'STL',
            'BLK',
            'TOV',
            'PF',
            'PTS',
        ]

        let selector = document.getElementById('stat-selector')
        vis.possibleStats.forEach((item, index) => {
            let option = document.createElement('option')
            option.value = item
            option.innerHTML = item
            if (item === 'PTS') {
                option.setAttribute('selected', 'selected')
            }
            selector.appendChild(option)
        })

        selector.addEventListener('change', function (event) {
            let stat_filter = selector.value
            // Update tooltip on side
            vis.updateVis(vis.selectedState, stat_filter, vis.selectedYear)
            vis.playerTip.innerHTML = ''

            if (vis.selectedNode !== null) {
                vis.playerTip.appendChild(
                    vis.createPlayerInfoDiv(vis.selectedNode.player_id)
                )
            } else {
                vis.playerTip.innerHTML = '<br/><br/><br/><br/><br/><br/>'
            }
        })

        // Clear player filter function
        vis.clearPlayerSelected = function () {
            if (vis.selectedNode !== null) {
                let oldNode = document.getElementById(
                    `bc-node-${vis.selectedNode.id}`
                )
                oldNode.classList.remove('bc-selected')
                vis.playerTip.innerHTML = ''
                vis.selectedNode = null
                vis.dispatcher.call('deselectPlayer', event)
            }
            return
        }

        vis.getPrimaryPosition = function (d) {
            let pos = d.Pos.trim().split('-')
            return pos[0]
        }

        vis.positionColorMapping = {
            G: '#ffd880',
            PG: '#f298aa',
            SG: '#123dbb',
            C: '#ff3586',
            F: '#290149',
            SF: '#d24510',
            PF: '#73112c',
        }

        vis.positions = Object.keys(vis.positionColorMapping)

        vis.colorPalette = []
        vis.positions.forEach((color, idx) => {
            vis.colorPalette.push(vis.positionColorMapping[color])
        })

        // Position Colors.
        vis.color = d3
            .scaleOrdinal()
            .domain(vis.positions)
            .range(vis.colorPalette)

        // Add one square in the legend for each name.
        vis.legend = d3.select('#bc-player-legend')
        let size = 12
        vis.legend
            .selectAll('bc-square')
            .data(vis.positions)
            .enter()
            .append('circle')
            .attr('class', 'bc-square')
            .attr('id', (d) => `bc-square-${d}`)
            .attr('cx', function (d, i) {
                if (i > 2) return 70
                else return 15
            })
            .attr('cy', function (d, i) {
                return (i % 4) * (size + 15) + 20
            })
            .attr('r', size)
            .attr('value', (d) => d)
            .style('fill', function (d) {
                return vis.color(d)
            })
            .on('click', function (event) {
                vis.addGray(event.target.getAttribute('value'))
            })

        // Add text label
        vis.legend
            .selectAll('bc-text-label')
            .data(vis.positions)
            .enter()
            .append('text')
            .attr('x', function (d, i) {
                if (i > 2) return 70 + size * 1.2
                else return 15 + size * 1.2
            })
            .attr('y', function (d, i) {
                return (i % 4) * (size + 15) + 15 + size / 2
            })
            .text(function (d) {
                return d
            })
            .attr('text-anchor', 'left')
            .style('alignment-baseline', 'middle')

        // Locate player tooltip
        vis.playerTip = document.getElementById('bc-player-tooltip')
        vis.playerTip.innerHTML = ''

        // Locate state tooltip
        vis.stateTip = document.getElementById('bc-state-tooltip')

        // Create player info div function
        vis.createPlayerInfoDiv = function (d) {
            let newDiv = document.createElement('div')
            let stat = vis.data.filter((player) => {
                return d === player.player_id
            })[0]

            const hallOfFameText = `<li><b>Hall of Fame</b> 🏆</li>`
            newDiv.innerHTML = `
                <ul class="display">
                <li><b>Age:</b> ${stat.Age}</li>
                <li><b>Height: </b>  ${stat.height} cm</li>
                <li><b>Weigth: </b> ${stat.weight} kg</li>
                <li><b>${vis.selectedStat}: </b>  ${stat[vis.selectedStat]}</li>
                ${stat.Player.includes('*') ? hallOfFameText : ''}
                </ul>
            `
            return newDiv
        }

        // Update tool tip on left
        vis.createStateInfoDiv = function () {
            let newDiv = document.createElement('div')
            let state = vis.selectedState

            if (state === '' || state === null) {
                vis.selectedState = ''
                vis.stateTip.innerHTML = ''
            } else {
                const interNationalString = `
                In the <b>${vis.selectedYear}</b> NBA season, there were <b>
                ${vis.playerCount}</b> active international players in the NBA</b>.
                `

                const stateString = `In the <b>${vis.selectedYear}</b> NBA season,
                there were <b>${vis.playerCount}</b> active players in the NBA from <b>${state}</b>.`

                newDiv.innerHTML = `
                <p class="display">
                ${state === 'International' ? interNationalString : stateString}
                </p>
            
                <p class="display">
                They had a combined average total <b>${
                    vis.selectedStat
                }</b> of <b>${vis.stateAverage.toFixed(2)}</b>.
                </p>
            `
                vis.stateTip.innerHTML = ''
                vis.stateTip.append(newDiv)
            }
            return
        }

        selector.value = vis.selectedStat
        vis.updateVis(vis.selectedState, vis.selectedStat, vis.selectedYear)
    }

    updateVis(state, stat, year) {
        let vis = this

        vis.selectedState = state
        vis.selectedStat = stat
        vis.selectedYear = year

        if (vis.data && vis.selectedState && vis.selectedYear) {
            if (vis.selectedState === 'International') {
                // Concat groups into one big array
                let finalArr = []
                vis.data.forEach((arr, index) => {
                    finalArr = finalArr.concat(arr)
                })
                vis.data = finalArr
            }

            // Calculated State Averages
            vis.playerCount = vis.data.length

            let total = 0
            vis.data.forEach((value, index) => {
                total += +value[vis.selectedStat]
            })

            if (vis.playerCount > 0) {
                vis.stateAverage = total / vis.playerCount
            } else {
                vis.stateAverage = 0
            }

            vis.createStateInfoDiv()
            vis.renderVis(vis.selectedStat)
        } else {
            // No state selected
            vis.createStateInfoDiv()
            vis.clearVis()
        }
    }

    clearVis() {
        let vis = this
        vis.bubbles = vis.svg.selectAll('.bubble').data([], function (d) {
            return
        })

        vis.bubbles.exit().remove()
    }

    /**
     * Bind data to visual elements
     */
    renderVis(stat) {
        let vis = this

        vis.nodes = vis.createNodes(vis.data, stat)

        // Bind nodes data
        vis.bubbles = vis.svg
            .selectAll('.bubble')
            .data(vis.nodes, function (d) {
                return d.id
            })

        vis.bubbles.exit().remove()

        let bubblesE = vis.bubbles
            .enter()
            .append('circle')
            .attr('class', (d) => `bubble ${d.position}`)
            .attr('id', (d) => `bc-node-${d.id}`)
            .attr('r', 0)
            .attr('fill', function (d) {
                return vis.color(d.position)
            })
            .attr('stroke', function (d) {
                return d3.rgb(vis.color(d.position)).darker()
            })
            .attr('stroke-width', 2)
            .on('click', (event, d) => {
                // Disabled
                if (event.target.classList.contains('bc-gray')) {
                    return
                }

                if (event.target.classList.contains('bc-selected')) {
                    // Deselect node event
                    event.target.classList.remove('bc-selected')
                    vis.selectedNode = null
                    vis.playerTip.innerHTML = ''
                    vis.dispatcher.call('deselectPlayer', event)
                } else {
                    if (vis.selectedNode !== null) {
                        let oldNode = document.getElementById(
                            `bc-node-${vis.selectedNode.id}`
                        )
                        oldNode.classList.remove('bc-selected')
                        vis.playerTip.innerHTML = ''
                    }

                    vis.selectedNode = d
                    event.target.classList.add('bc-selected')

                    // Update tooltip on side
                    vis.playerTip.innerHTML = ''
                    vis.playerTip.appendChild(
                        vis.createPlayerInfoDiv(vis.selectedNode.player_id)
                    )

                    let player = {
                        name: vis.selectedNode.name,
                        player_id: vis.selectedNode.player_id,
                        position: vis.selectedNode.position,
                    }
                    vis.dispatcher.call('selectPlayer', event, player)
                }
            })
            .on('mouseover', (event, d) => {
                const hallOfFameText = `<li><b>Hall of Fame</b> 🏆</li>`

                if (event.target.classList.contains('bc-gray')) return
                d3.select('#tooltip').style('display', 'block').html(`
                        <h4>${d.name} - ${d.position}</h4>
                        <ul class="display">
                        <li><b>Age:</b> ${d.age}</li>
                        <li><b>Height: </b>  ${d.height} cm</li>
                        <li><b>Weigth: </b> ${d.weight} kg</li>
                        <li><b>${vis.selectedStat}: </b>  ${d.value}</li>
                        ${d.hof ? hallOfFameText : ''}
                        </ul>
                    `)
            })
            .on('mousemove', (event) => {
                if (event.target.classList.contains('bc-gray')) return
                d3.select('#tooltip')
                    .style('left', event.pageX + 16 + 'px')
                    .style('top', event.pageY + 16 + 'px')
            })
            .on('mouseleave', (event) => {
                if (event.target.classList.contains('bc-gray')) return
                d3.select('#tooltip').style('display', 'none')
            })

        vis.bubbles = vis.bubbles.merge(bubblesE)

        // Smooth transition
        vis.bubbles
            .transition()
            .duration(1000)
            .attr('r', function (d) {
                return d.radius
            })

        vis.simulation.nodes(vis.nodes)

        // Set initial layout to single group.
        vis.simulation.alpha(1).restart()
    }

    addGray(position) {
        let vis = this

        let checkPos = position
        if (vis.selectedPosition === checkPos) {
            document
                .getElementById(`bc-square-${vis.selectedPosition}`)
                .classList.toggle('active')
            vis.selectedPosition = null
            checkPos = ''
        } else {
            if (vis.selectedPosition !== null) {
                document
                    .getElementById(`bc-square-${vis.selectedPosition}`)
                    .classList.toggle('active')
            }
            document
                .getElementById(`bc-square-${checkPos}`)
                .classList.toggle('active')
            vis.selectedPosition = checkPos
        }

        vis.data.forEach(function (value, index) {
            let element = document.getElementById(`bc-node-${value.id}`)
            if (checkPos !== '' && !element.classList.contains(checkPos)) {
                element.classList.add('bc-gray')

                if (element.classList.contains('bc-selected')) {
                    vis.clearPlayerSelected()
                }
            } else {
                element.classList.remove('bc-gray')
            }
        })
    }
}
