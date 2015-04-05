#!/usr/bin/env node

'use strict';

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var jsdom = require('jsdom').jsdom;

var isAnExample = function(filename) {
    return /[0-9][0-9][0-9][0-9].*\.html/.test(filename);
};

var isJavascript = function(filename) {
    return /.*\.js/.test(filename);
};

var cleanJavascriptFilesFromControllersDirectory = function(dir) {
    fs.readdir(dir, function(err, list) {
        list.forEach(function(filename) {
            if (isJavascript(filename)) {
                fs.unlink(path.join(dir, filename));
            }
        });
    })
};

var writeController = function(script, examplefile, controllers_directory) {
    var scriptLines = script.split('\n');
    var outfilename;
    var outScript = [];
    for (var i = 0; i < scriptLines.length; i++) {

        var line = scriptLines[i];

        // Remove empty lines
        if (line.replace(/^\s+|\s+$/g, '') === '') {
            continue;
        }

        // Remove the module initializacion line
        if (line.search('angular.module') !== -1) {
            continue;
        }

        // Extract controller name
        if (line.search('app.controller') !== -1) {
            var controller = line.match(/app.controller\((\'|\")([^'"]*)/);
            if (controller && controller.length > 2 && controller[2]) {
                outfilename = controller[2] + '.js';
            }
        }

        outScript.push(line);
    }

    if (outfilename) {
        outfilename = path.join(controllers_directory, outfilename);
        if (!fs.existsSync(outfilename)) {
            var file = fs.createWriteStream(outfilename);
            outScript.forEach(function(line) {
                file.write(line + '\n');
            });

            file.end();
        } else {
            console.log('The controller name is duplicated: ' + outfilename)
        }
    } else {
        console.log('Can\'t identify the controller name in the example ' + examplefile)
    }
};

var generateControllersFromExamples = function(examples_directory, controllers_directory) {
    fs.readdir(examples_directory, function(err, list) {
        list.forEach(function(filename) {
            if (isAnExample(filename)) {
                var html = fs.readFileSync(path.join(__dirname, 'examples-reworked', filename));
                var document = jsdom(html.toString());
                var scripts = document.getElementsByTagName('script');
                var last = scripts.length -1;
                var script = scripts[last].innerHTML;

                writeController(script, filename, controllers_directory);
            }
        });
    });
};

var extractId = function(filename) {
    var arr = filename.replace('.html', '').split('-');
    arr.splice(0,2);
    return arr.join('-');
};

var extractTitle = function(filename) {
    var html = fs.readFileSync(path.join(__dirname, 'examples-reworked', filename));
    var title;
    var arr = html.toString().split('\n');

    for (var i = 0; i< arr.length; i++) {
        var line = arr[i];

        if (line.search('<h1>') !== -1) {
            title = line.replace('<h1>', '').replace('</h1>', '').replace(/^ */, '');
        }
    }

    return title;
};

var extractDescription = function(filename) {

};

var extractDate = function(filename) {
    var stats = fs.statSync(filename);
    return stats.mtime;
};

var generateExamplesJSONFile = function(examples_directory, json_file) {
    var examples = {};
    fs.readdir(examples_directory, function(err, list) {
        list.forEach(function(filename) {
            if (isAnExample(filename)) {
                var section = filename.split('-')[1];
                var id = extractId(filename);
                var extUrl = filename;
                var title = extractTitle(filename);
                var description = extractDescription(filename);
                var date = extractDate(path.join(examples_directory, filename));

                if (!(section in examples)) {
                    examples[section] = [];
                }
                examples[section].push({
                    date: date,
                    section: section,
                    id: '/' + section + '/' + id,
                    extUrl: extUrl,
                    title: title,
                    description: description
                });
            }
        });

        var f = fs.createWriteStream(json_file);
        f.write(JSON.stringify(examples, null, 4));
        f.close();

    });
};

var controllers_directory = path.join(__dirname, 'examples-reworked', 'js', 'controllers');
mkdirp(controllers_directory, function(err) {
    cleanJavascriptFilesFromControllersDirectory(controllers_directory);

    var examples_directory = path.join(__dirname, 'examples-reworked');
    generateControllersFromExamples(examples_directory, controllers_directory);

    var json_file = path.join(__dirname, 'examples-reworked', 'json', 'examples.json');
    generateExamplesJSONFile(examples_directory, json_file);
})
