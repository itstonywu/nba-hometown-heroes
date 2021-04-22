class CareerMap {
    /**
     * Class constructor with basic chart configuration
     * @param {Object}
     * @param {Array}
     */
    constructor(_config, _dispatcher, _map_data, _data, _location_dicts) {
        // Configuration object with defaults
        this.config = {
            parentElement: _config.parentElement,
            listElement: _config.listElement,
            containerWidth: _config.containerWidth || 1150,
            containerHeight: _config.containerHeight || 600,
            margin: _config.margin || { top: 0, right: 0, bottom: 0, left: 0 },
            projection: _config.projection || d3.geoMercator(),
            cityPointSize: _config.cityPointSize || 3,
            selPointOpacity: _config.selPointOpacity || 1,
            selPointColor: _config.selPointColor || '#00ff7f',
            pointOpacity: _config.pointOpacity || 0.4,
            cityPointColor: _config.cityPointColor || '#f92379',
            tooltipPadding: _config.tooltipPadding || 16,
            lineColor: _config.lineColor || '#0d319b',
        }
        this.map_data = _map_data
        this.data = _data
        this.location_dicts = _location_dicts

        this.selectedPlayers = []

        this.initVis()
        // adding this to commit
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
            .attr('viewBox', [
                0,
                0,
                vis.config.containerWidth,
                vis.config.containerHeight,
            ])

        // Append group element that will contain our actual chart
        // and position it according to the given margin config
        vis.chart = vis.svg
            .append('g')
            .attr(
                'transform',
                `translate(${vis.config.margin.left},${vis.config.margin.top})`
            )

        vis.zoom = d3.zoom()

        vis.list = d3.select(vis.config.listElement)

        vis.careerList = d3.select('.career__list')

        vis.svg
            .call(
                vis.zoom
                    .extent([
                        [0, 0],
                        [vis.config.containerWidth, vis.config.containerHeight],
                    ])
                    .scaleExtent([1, 1])
                    .on('zoom', function ({ transform }) {
                        vis.chart.attr('transform', transform)
                    })
            )
            .on('mousedown.zoom', null)
            .on('touchstart.zoom', null)
            .on('touchmove.zoom', null)
            .on('touchend.zoom', null)

        d3.select('#career-us-button').on('click', function () {
            vis.zoom.scaleExtent([4.5, 4.5])
            vis.svg.transition().call(vis.zoom.scaleTo, 4.5, [200, 120])

            const isActive = d3.select(this).classed('button--active')
            d3.selectAll('.button').classed('button--active', false)
            d3.select(this).classed('button--active', !isActive)
        })

        d3.select('#career-world-button').on('click', function () {
            vis.zoom.scaleExtent([1, 1])
            vis.svg.transition().call(vis.zoom.transform, d3.zoomIdentity)

            const isActive = d3.select(this).classed('button--active')
            d3.selectAll('.button').classed('button--active', false)
            d3.select(this).classed('button--active', !isActive)
        })

        vis.config.projection = d3
            .geoNaturalEarth1()
            .fitSize([vis.width, vis.height], vis.map_data)

        vis.geoPath = d3.geoPath().projection(vis.config.projection)

        // Definition for arrowhead
        vis.chart
            .append('defs')
            .append('marker')
            .attr('id', 'arrow-head')
            .attr('markerUnits', 'strokeWidth')
            .attr('refX', '2')
            .attr('refY', '2')
            .attr('markerWidth', '10')
            .attr('markerHeight', '10')
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,0 L2,2 L 0,4')
            .attr('stroke', vis.config.lineColor)
            .attr('fill', 'none')
    }

    updateVis() {
        let vis = this

        vis.filteredData = d3.filter(vis.data, (d) =>
            vis.selectedPlayers.includes(d[0])
        )

        vis.renderVis()
    }

    /**
     * Bind data to visual elements
     */
    renderVis() {
        let vis = this

        // Convert compressed TopoJSON to GeoJSON format
        const countries = topojson.feature(
            vis.map_data,
            vis.map_data.objects.countries
        )

        // Defines the scale of the projection so that the geometry fits within the SVG area
        vis.config.projection.fitSize([vis.width, vis.height], countries)

        // Append shapes of Canadian provinces
        const geoPath = vis.chart
            .selectAll('.geo-path')
            .data(countries.features)
            .join('path')
            .attr('class', 'geo-path')
            .attr('d', vis.geoPath)
            .attr('fill', 'lightgray')

        const playerGroup = vis.chart
            .selectAll('.player-group')
            .data(vis.filteredData, (d) => d[0])
            .join('g')
            .attr('class', 'player-group')

        const playerList = vis.list
            .selectAll('.player-list')
            .data(vis.filteredData, (d) => d[0])
            .join('ul')
            .attr('class', 'player-list')

        // Only need to add a line between hometown and college if hometown exists
        const homeToCollege = playerGroup
            .selectAll('.home-to-college')
            .data((d) => [d[1][0]])
            .join('line')
            .attr('class', 'home-to-college')
            .attr('stroke', vis.config.lineColor)
            .attr('stroke-width', 1)
            .attr('x1', (d) => {
                if (d.college != '' && d.birth_city != '') {
                    const cityState = (
                        d.birth_city +
                        ' ' +
                        d.birth_state
                    ).replace(/\s\s+/g, ' ')
                    return vis.config.projection([
                        vis.location_dicts.hometown[cityState].long,
                        vis.location_dicts.hometown[cityState].lat,
                    ])[0]
                }
            })
            .attr('y1', (d) => {
                if (d.college != '' && d.birth_city != '') {
                    const cityState = (
                        d.birth_city +
                        ' ' +
                        d.birth_state
                    ).replace(/\s\s+/g, ' ')
                    return vis.config.projection([
                        vis.location_dicts.hometown[cityState].long,
                        vis.location_dicts.hometown[cityState].lat,
                    ])[1]
                }
            })
            .attr('x2', (d) => {
                if (d.college != '' && d.birth_city != '') {
                    return vis.config.projection([
                        vis.location_dicts.college[d.college].long,
                        vis.location_dicts.college[d.college].lat,
                    ])[0]
                }
            })
            .attr('y2', (d) => {
                if (d.college != '' && d.birth_city != '') {
                    return vis.config.projection([
                        vis.location_dicts.college[d.college].long,
                        vis.location_dicts.college[d.college].lat,
                    ])[1]
                }
            })

        // Visualizes the connections between the teams
        const teamConnections = playerGroup
            .selectAll('.team-to-team')
            .data((d) => d[1])
            .join('line')
            .attr('class', 'team-to-team')
            .attr('stroke', vis.config.lineColor)
            .attr('stroke-width', 1)
            .attr('x1', (d, i, a) => {
                // use college or hometown if first team
                if (i == 0) {
                    if (d.college != '') {
                        return vis.config.projection([
                            vis.location_dicts.college[d.college].long,
                            vis.location_dicts.college[d.college].lat,
                        ])[0]
                    } else if (d.birth_city != '') {
                        const cityState = (
                            d.birth_city +
                            ' ' +
                            d.birth_state
                        ).replace(/\s\s+/g, ' ')
                        return vis.config.projection([
                            vis.location_dicts.hometown[cityState].long,
                            vis.location_dicts.hometown[cityState].lat,
                        ])[0]
                    }
                    return 0
                } else {
                    return vis.config.projection([
                        vis.location_dicts.team[a[i - 1].__data__.Tm].long,
                        vis.location_dicts.team[a[i - 1].__data__.Tm].lat,
                    ])[0]
                }
            })
            .attr('y1', (d, i, a) => {
                // use college or hometown if first team
                if (i == 0) {
                    if (d.college != '') {
                        return vis.config.projection([
                            vis.location_dicts.college[d.college].long,
                            vis.location_dicts.college[d.college].lat,
                        ])[1]
                    } else if (d.birth_city != '') {
                        const cityState = (
                            d.birth_city +
                            ' ' +
                            d.birth_state
                        ).replace(/\s\s+/g, ' ')
                        return vis.config.projection([
                            vis.location_dicts.hometown[cityState].long,
                            vis.location_dicts.hometown[cityState].lat,
                        ])[1]
                    }
                    return 0
                } else {
                    return vis.config.projection([
                        vis.location_dicts.team[a[i - 1].__data__.Tm].long,
                        vis.location_dicts.team[a[i - 1].__data__.Tm].lat,
                    ])[1]
                }
            })
            .attr('x2', (d) => {
                return vis.config.projection([
                    vis.location_dicts.team[d.Tm].long,
                    vis.location_dicts.team[d.Tm].lat,
                ])[0]
            })
            .attr('y2', (d) => {
                return vis.config.projection([
                    vis.location_dicts.team[d.Tm].long,
                    vis.location_dicts.team[d.Tm].lat,
                ])[1]
            })
            .attr('marker-end', (d, i, a) => {
                if (a.length - 1 == i) {
                    return 'url(#arrow-head)'
                }
            })

        const listhometownLocation = playerList
            .selectAll('.list-hometown-location')
            .data((d) => [d[1][0]])
            .join('li')
            .attr('class', 'list-hometown-location')
            .html((d) => {
                return `
                <div class="list__container">
                    <div class="list__icon"><p class="display">👶</p></div>
                    <div class="list__text"><p class="display">Born in <b>${(
                        d.birth_city +
                        ', ' +
                        d.birth_state
                    ).replace(/\s\s+/g, ' ')}</b> in <b>${d.born}</b></p></div>
                </div>
                `
            })

        const listcollegeLocation = playerList
            .selectAll('.list-college-location')
            .data((d) => [d[1][0]])
            .join('li')
            .attr('class', 'list-college-location')
            .html((d) => {
                if (d.college != '') {
                    return `
                    <div class="list__container">
                        <div class="list__icon"><p class="display">📚</p></div>
                        <div class="list__text"><p class="display">Went to college at <b>${d.college}</b></p></div>
                    </div>`
                }
            })

        const listplayerLocation = playerList
            .selectAll('.list-player-location')
            .data((d) => d[1])
            .join('li')
            .attr('class', 'list-player-location')
            .html((d) => {
                return `
                <div class="list__container">
                        <div class="list__icon"><p class="display">🏀</p></div>
                        <div class="list__text"><p class="display">
                    Played for the <b>${vis.location_dicts.team[
                        d.Tm
                    ].display_name.replace(/\*$/, '')}</b> in <b>${
                    vis.location_dicts.team[d.Tm].display_city
                }</b> from <b>${d.teamStartYear}</b> to <b>${
                    d.teamEndYear
                }</b></p>
                    </div>
                </div>
                `
            })

        const hometownLocation = playerGroup
            .selectAll('.hometown-location')
            .data((d) => [d[1][0]])
            .join('circle')
            .attr('class', 'hometown-location')
            .attr('id', (d) => 'hl' + d.player_id)
            .attr('r', vis.config.cityPointSize)
            .attr('fill', vis.config.cityPointColor)
            .attr('opacity', vis.config.pointOpacity)
            .attr('cx', (d) => {
                const cityState = (d.birth_city + ' ' + d.birth_state).replace(
                    /\s\s+/g,
                    ' '
                )
                return vis.config.projection([
                    vis.location_dicts.hometown[cityState].long,
                    vis.location_dicts.hometown[cityState].lat,
                ])[0]
            })
            .attr('cy', (d) => {
                const cityState = (d.birth_city + ' ' + d.birth_state).replace(
                    /\s\s+/g,
                    ' '
                )
                return vis.config.projection([
                    vis.location_dicts.hometown[cityState].long,
                    vis.location_dicts.hometown[cityState].lat,
                ])[1]
            })

        const collegeLocation = playerGroup
            .selectAll('.college-location')
            .data((d) => [d[1][0]])
            .join('circle')
            .attr('class', 'college-location')
            .attr('id', (d) => 'cl' + d.player_id)
            .attr('r', vis.config.cityPointSize)
            .attr('fill', vis.config.cityPointColor)
            .attr('opacity', vis.config.pointOpacity)
            .attr('cx', (d) => {
                if (d.college != '') {
                    return vis.config.projection([
                        vis.location_dicts.college[d.college].long,
                        vis.location_dicts.college[d.college].lat,
                    ])[0]
                }
            })
            .attr('cy', (d) => {
                if (d.college != '') {
                    return vis.config.projection([
                        vis.location_dicts.college[d.college].long,
                        vis.location_dicts.college[d.college].lat,
                    ])[1]
                }
            })

        const playerLocation = playerGroup
            .selectAll('.player-location')
            .data((d) => d[1])
            .join('circle')
            .attr('class', 'player-location')
            .attr('id', (d) => 'pl' + d.player_id + '-' + d.id)
            .attr('r', vis.config.cityPointSize)
            .attr('r', vis.config.cityPointSize)
            .attr('fill', vis.config.cityPointColor)
            .attr('opacity', vis.config.pointOpacity)
            .attr(
                'cx',
                (d) =>
                    vis.config.projection([
                        vis.location_dicts.team[d.Tm].long,
                        vis.location_dicts.team[d.Tm].lat,
                    ])[0]
            )
            .attr(
                'cy',
                (d) =>
                    vis.config.projection([
                        vis.location_dicts.team[d.Tm].long,
                        vis.location_dicts.team[d.Tm].lat,
                    ])[1]
            )

        listhometownLocation
            .on('mouseover', (event, d) => {
                const vis = this
                const home = vis.chart.selectAll('#hl' + d.player_id)

                home.attr('stroke', vis.config.lineColor)
                home.attr('opacity', vis.config.selPointOpacity)
                home.attr('fill', vis.config.selPointColor)
            })
            .on('mouseleave', (event, d) => {
                const vis = this
                const home = vis.chart.selectAll('#hl' + d.player_id)

                home.attr('stroke', '')
                home.attr('opacity', vis.config.pointOpacity)
                home.attr('fill', vis.config.cityPointColor)
            })

        listcollegeLocation
            .on('mouseover', (event, d) => {
                const vis = this
                const college = vis.chart.selectAll('#cl' + d.player_id)

                college.attr('stroke', vis.config.lineColor)
                college.attr('opacity', vis.config.selPointOpacity)
                college.attr('fill', vis.config.selPointColor)
            })
            .on('mouseleave', (event, d) => {
                const vis = this
                const college = vis.chart.selectAll('#cl' + d.player_id)

                college.attr('stroke', '')
                college.attr('opacity', vis.config.pointOpacity)
                college.attr('fill', vis.config.cityPointColor)
            })

        listplayerLocation
            .on('mouseover', (event, d) => {
                const vis = this
                const team = vis.chart.selectAll(
                    '#pl' + d.player_id + '-' + d.id
                )

                team.attr('stroke', vis.config.lineColor)
                team.attr('opacity', vis.config.selPointOpacity)
                team.attr('fill', vis.config.selPointColor)
            })
            .on('mouseleave', (event, d) => {
                const vis = this
                const team = vis.chart.selectAll(
                    '#pl' + d.player_id + '-' + d.id
                )

                team.attr('stroke', '')
                team.attr('opacity', vis.config.pointOpacity)
                team.attr('fill', vis.config.cityPointColor)
            })

        hometownLocation
            .on('mouseover', (event, d) => {
                const vis = this
                const home = vis.chart.selectAll('#hl' + d.player_id)

                home.attr('stroke', vis.config.lineColor)
                home.attr('opacity', vis.config.selPointOpacity)
                home.attr('fill', vis.config.selPointColor)

                const cityState = (d.birth_city + ' ' + d.birth_state).replace(
                    /\s\s+/g,
                    ' '
                )
                d3
                    .select('#tooltip')
                    .style('display', 'block')
                    .style(
                        'left',
                        event.pageX + vis.config.tooltipPadding + 'px'
                    )
                    .style(
                        'top',
                        event.pageY + vis.config.tooltipPadding + 'px'
                    ).html(`
                        <h4>👶 Born - ${d.born}</h4>
                        <p>📌 ${(d.birth_city + ', ' + d.birth_state).replace(
                            /\s\s+/g,
                            ' '
                        )}</p>
            
          `)
            })
            .on('mousemove', (event, d) => {
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
            .on('mouseleave', (event, d) => {
                const vis = this
                const home = vis.chart.selectAll('#hl' + d.player_id)

                home.attr('stroke', '')
                home.attr('opacity', vis.config.pointOpacity)
                home.attr('fill', vis.config.cityPointColor)

                d3.select('#tooltip').style('display', 'none')
            })

        collegeLocation
            .on('mouseover', (event, d) => {
                const vis = this
                const college = vis.chart.selectAll('#cl' + d.player_id)

                college.attr('stroke', vis.config.lineColor)
                college.attr('opacity', vis.config.selPointOpacity)
                college.attr('fill', vis.config.selPointColor)

                d3
                    .select('#tooltip')
                    .style('display', 'block')
                    .style(
                        'left',
                        event.pageX + vis.config.tooltipPadding + 'px'
                    )
                    .style(
                        'top',
                        event.pageY + vis.config.tooltipPadding + 'px'
                    ).html(`
            
            <h4>📚 ${d.college}</h4>
            <p>📌 ${vis.location_dicts.college[d.college].display_city}</p>
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
            .on('mouseleave', (event, d) => {
                const vis = this
                const college = vis.chart.selectAll('#cl' + d.player_id)

                college.attr('stroke', '')
                college.attr('opacity', vis.config.pointOpacity)
                college.attr('fill', vis.config.cityPointColor)

                d3.select('#tooltip').style('display', 'none')
            })

        playerLocation
            .on('mouseover', (event, d) => {
                const vis = this
                const team = vis.chart.selectAll(
                    '#pl' + d.player_id + '-' + d.id
                )

                team.attr('stroke', vis.config.lineColor)
                team.attr('opacity', vis.config.selPointOpacity)
                team.attr('fill', vis.config.selPointColor)

                d3
                    .select('#tooltip')
                    .style('display', 'block')
                    .style(
                        'left',
                        event.pageX + vis.config.tooltipPadding + 'px'
                    )
                    .style(
                        'top',
                        event.pageY + vis.config.tooltipPadding + 'px'
                    ).html(`
                <h4>🏀 ${vis.location_dicts.team[d.Tm].display_name}, ${
                    d.teamStartYear
                } - ${d.teamEndYear}</h4>
                <p>📌 ${vis.location_dicts.team[d.Tm].display_city}</p>
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
            .on('mouseleave', (event, d) => {
                const vis = this
                const team = vis.chart.selectAll(
                    '#pl' + d.player_id + '-' + d.id
                )

                team.attr('stroke', '')
                team.attr('opacity', vis.config.pointOpacity)
                team.attr('fill', vis.config.cityPointColor)

                d3.select('#tooltip').style('display', 'none')
            })
    }

    zoomIn() {
        const vis = this

        vis.zoom.scaleExtent([4.5, 4.5])
        vis.svg.transition().call(vis.zoom.scaleTo, 4.5, [200, 120])
    }

    zoomOut() {
        const vis = this

        vis.zoom.scaleExtent([1, 1])
        vis.svg.transition().call(vis.zoom.transform, d3.zoomIdentity)
    }
}
