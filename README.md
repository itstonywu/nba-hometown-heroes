# 🏀 NBA Hometown Heroes

![Thumbnail](/thumbnail.png)

A data visualization project made with D3.js showing the places that NBA players help put on the map.

## 📚 Datasets
This visualization uses [NBA player data](https://www.kaggle.com/drgilermo/nba-players-stats?select=Seasons_Stats.csv) from 1950 to 2017 with 50+ attributes per player. Location data was collected using the Google Maps API.

## 🧰 Getting Started
The following extensions are required for VSCode.

* [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
* [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
* [Live Sass Compiler](https://marketplace.visualstudio.com/items?itemName=ritwickdey.live-sass) - Compiles SCSS to CSS

## 📝 Repository overview

```
.
├── css                     # Compiled minified CSS
├── data                    # Source dataset files
├── js                      # Javascript files for visualizations
├── preprocess              # Preprocessing script to retrieve location data using Google Maps API
├── scss                    # SCSS files
├── index.html              # Page markup
└── README.md
```

## 🎨 Working with SASS

SASS enables our team to stay organized with our styling, and also enables the use of functions and variables. Using the Live Sass Compiler, all SCSS files gets compiled into a minified CSS file.

The structure of the SCSS files starts with the most primitive and increases to higher level components.

```
@import 'base'            # Base styles
@import 'typography'      # Typography styles (heading, paragraph, etc.)
@import 'components'      # Component styles (inputs, tooltips, select fields)
@import 'layout'          # Layout styles (positioning sections, right or left alignment classes)
@import 'intro'           # Intro styles (content area before the visualizations)
@import 'vis/index'       # Visualization styles
```
