class CollegeGraph {
    /**
     * Class constructor with basic chart configuration
     * @param {Object}
     * @param {Array}
     */
    constructor(_config, _dispatcher, _data) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            colorScale: _config.colorScale,
            containerWidth: _config.containerWidth || 700,
            containerHeight: _config.containerHeight || 700,
            margin: { top: 50, right: 25, bottom: 40, left: 50 },
            colors: _config.colors || {
                edge: 'lightgray',
                edgeSameState: '#0d319b',
            },
        }
        this.masterData = _data.filter(function (d) {
            return d.id !== ''
        })
        this.data = this.masterData
        this.nodes = null
        this.links = null
        this.playerSelected = null
        this.initVis()
    }

    /**
     * Initialize scales/axes and append static elements, such as axis titles
     */
    initVis() {
        let vis = this

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.config.width =
            vis.config.containerWidth -
            vis.config.margin.left -
            vis.config.margin.right
        vis.config.height =
            vis.config.containerHeight -
            vis.config.margin.top -
            vis.config.margin.bottom

        vis.getPrimaryPosition = function (d) {
            let pos = d.Pos.trim().split('-')
            return pos[0]
        }

        // Initialize scales
        vis.positionColorMapping = {
            G: '#ffd880',
            PG: '#f298aa',
            SG: '#123dbb',
            F: '#290149',
            SF: '#d24510',
            PF: '#73112c',
            C: '#ff3586',
        }

        vis.positions = Object.keys(vis.positionColorMapping)

        vis.colorPalette = []
        vis.positions.forEach((color, idx) => {
            vis.colorPalette.push(vis.positionColorMapping[color])
        })

        // Position Colors.
        vis.colorScale = d3
            .scaleOrdinal()
            .domain(vis.positions)
            .range(vis.colorPalette)

        // Define size of SVG drawing area
        vis.svg = d3
            .select(vis.config.parentElement)
            .append('svg')
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight)

        // Append group element that will contain our actual chart
        // and position it according to the given margin config
        vis.chart = vis.svg
            .append('g')
            .attr(
                'transform',
                `translate(${vis.config.margin.left},${vis.config.margin.top})`
            )

        vis.textArea = document.getElementById('cc-connection-text')

        // Initialize force simulation
        vis.simulation = d3
            .forceSimulation()
            .force(
                'link',
                d3.forceLink().id((d) => d.id)
            )
            .force('charge', d3.forceManyBody().strength(-1500))
            .force(
                'center',
                d3.forceCenter(vis.config.width / 2, vis.config.height / 2)
            )

        vis.simulation.stop()

        vis.createNodeLinks = function (player_id) {
            vis.playerSelected = vis.masterData.filter((d) => {
                return d.player_id === player_id
            })

            let playerBirthState = vis.playerSelected[0].birth_state
            vis.sameBirthStateCount = 0

            if (
                vis.playerSelected[0].college === '' ||
                vis.playerSelected[0].college === null
            ) {
                let onlyNode = {
                    id: vis.playerSelected[0].player_id,
                    name: vis.playerSelected[0].Player.replace(/\*$/, ''),
                    position: vis.getPrimaryPosition(vis.playerSelected[0]),
                    birth_state: vis.playerSelected[0].birth_state,
                    year_start:
                        vis.playerSelected[0].year_start ||
                        vis.playerSelected[0].Year,
                    year_end:
                        vis.playerSelected[0].year_end ||
                        vis.playerSelected[vis.playerSelected.length - 1].Year,
                }
                onlyNode.years_played =
                    onlyNode.year_end - onlyNode.year_start + 1

                vis.radiusScale = d3
                    .scalePow()
                    .exponent(0.5)
                    .range([4, 20])
                    .domain([1, onlyNode.years_played])
                vis.nodes = [onlyNode]
                vis.links = []
                vis.positionCounts = d3.rollup(
                    vis.nodes,
                    (v) => v.length,
                    (d) => d.position
                )
                return false
            }

            vis.data = vis.masterData.filter((d) => {
                return d.college === vis.playerSelected[0].college
            })
            vis.data = d3.group(vis.data, (d) => d.player_id)

            let maxAmount = 1
            let myNodes = []
            vis.data.forEach((value, key) => {
                let newNode = {
                    id: key,
                    name: value[0].Player.replace(/\*$/, ''),
                    position: vis.getPrimaryPosition(value[0]),
                    birth_state: value[0].birth_state,
                    year_start: value[0].year_start || value[0].Year,
                    year_end: value[0].year_end || value[value.length - 1].Year,
                }

                newNode.years_played = newNode.year_end - newNode.year_start + 1

                if (newNode.years_played > maxAmount) {
                    maxAmount = value.length
                }

                myNodes.push(newNode)
            })

            vis.radiusScale = d3
                .scalePow()
                .exponent(0.5)
                .range([4, 20])
                .domain([1, maxAmount])

            let myLinks = []
            myNodes.forEach((d, index) => {
                if (d.id !== player_id) {
                    let link = {
                        source: player_id,
                        target: d.id,
                        sameBirthState:
                            d.birth_state === playerBirthState ? true : false,
                    }

                    if (d.birth_state === playerBirthState) {
                        vis.sameBirthStateCount++
                    }

                    myLinks.push(link)
                }
            })

            vis.nodes = myNodes
            vis.links = myLinks
            vis.positionCounts = d3.rollup(
                vis.nodes,
                (v) => v.length,
                (d) => d.position
            )
            return true
        }

        vis.resetView = function () {
            vis.nodes = []
            vis.links = []
            vis.playerSelected = null

            vis.textArea.innerHTML = ''

            // Add node-link data to simulation
            vis.simulation.nodes(vis.nodes)
            vis.simulation.force('link').links(vis.links)

            vis.renderVis()
        }

        vis.updateVis(-1)
    }

    updateVis(player_id) {
        let vis = this

        if (player_id === -1) {
            return
        }

        let collegeFound = vis.createNodeLinks(player_id)

        if (vis.nodes === null) {
            return
        }

        let text = ''
        if (collegeFound) {
            text = `
                <p class="display">${vis.playerSelected[0].Player.replace(
                    /\*$/,
                    ''
                )} went to the <b>${vis.playerSelected[0].college}.</b></p>
                <p class="display">Since 1950, <b>${
                    vis.nodes.length
                } players</b> in the history of the NBA have attended the <b>${
                vis.playerSelected[0].college
            }.</b></p>

                <p class="display">
                    <b>${
                        vis.sameBirthStateCount
                    }</b> other players from his alma mater
                    are also born in <b>${
                        vis.playerSelected[0].birth_state
                    }</b>.
                </p>

                <p class="display"> Historically, the <b>${
                    vis.playerSelected[0].college
                }</b> has produced: </p>
            `
            if (vis.positionCounts.size > 0) {
                text += '<ul class="list--show">'
                vis.positionCounts.forEach((value, key) => {
                    value < 10
                        ? (text += '<li class="display"> ')
                        : (text += '<li class="display">')
                    text =
                        text +
                        `<b>${value}</b> players who play as a <b>${key}</b></li>`
                })
                text += '</ul>'
            }
        } else {
            text = `
                <p class="display">${vis.playerSelected[0].Player.replace(
                    /\*$/,
                    ''
                )} did not go to college.</p>
            `
        }

        vis.textArea.innerHTML = text

        // Add node-link data to simulation
        vis.simulation.nodes(vis.nodes)
        vis.simulation.force('link').links(vis.links)

        vis.renderVis()
    }

    /**
     * Bind data to visual elements
     */
    renderVis() {
        let vis = this

        // Add links
        let links = vis.chart
            .selectAll('line')
            .data(vis.links, (d) => [d.source, d.target])
            .join('line')
            .attr('stroke', (d) =>
                d.sameBirthState
                    ? vis.config.colors.edgeSameState
                    : vis.config.colors.edge
            )
            .attr('stroke-width', (d) => (d.sameBirthState ? 4 : 2))

        // Add nodes
        let nodes = vis.chart
            .selectAll('circle')
            .data(vis.nodes, (d) => d.id)
            .join('circle')

        nodes
            .transition()
            .duration(500)
            .attr('r', (d) => vis.radiusScale(d.years_played))
            .attr('fill', (d) => vis.colorScale(d.position))
            .attr('stroke', (d) => d3.rgb(vis.colorScale(d.position)).darker())
            .attr('stroke-width', 2)
            .attr('class', 'cc-bubble')

        nodes
            .on('mouseover', (event, d) => {
                let year_end = parseInt(d.year_end) + 1
                d3.select('#tooltip').style('display', 'block').html(`
                        <h4>${d.name} - ${d.position}</h4>
                        <p>Played ${d.years_played} season(s) from ${d.year_start} to ${year_end}.</p>
                    `)
            })
            .on('mousemove', (event) => {
                d3.select('#tooltip')
                    .style('left', event.pageX + 16 + 'px')
                    .style('top', event.pageY + 16 + 'px')
            })
            .on('mouseleave', (event) => {
                d3.select('#tooltip').style('display', 'none')
            })

        // Update positions
        vis.simulation
            .nodes(vis.nodes)
            .on('tick', () => {
                links
                    .attr('x1', (d) => d.source.x)
                    .attr('y1', (d) => d.source.y)
                    .attr('x2', (d) => d.target.x)
                    .attr('y2', (d) => d.target.y)

                nodes.attr('cx', (d) => d.x).attr('cy', (d) => d.y)
            })
            .force('link')
            .links(vis.links)

        vis.simulation.alpha(1).restart()
    }
}
