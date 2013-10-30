'use strict';

var fs = require('fs');
var path = require('path');
var TravisCi = require('..');
var _ = require('lodash');
require('should');

describe('travis ci api test suite', function () {
    this.timeout(30000);

    it('expects an api version', function () {
        var thrower = function () {
            new TravisCi();
        };
        thrower.should.throw();
    });

    it('only supports version 2.0.0', function () {
        var thrower = function () {
            new TravisCi({
                version: '3.0.0'
            });
        };
        thrower.should.throw();

        new TravisCi({
            version: '2.0.0'
        });
    });

    it('has up to date route definitions', function (done) {
        var travis = new TravisCi({
            version: '2.0.0'
        });
        var routesPath = path.resolve(__dirname, '../api/v2.0.0/routes.json');
        var routes = JSON.parse(fs.readFileSync(routesPath).toString());

        travis.endpoints(function (err, res) {
            if (!_.isEqual(routes, res)) {
                return done(new Error('stale route definitions'));
            }
            done();
        });
    });

    describe('endpoint test suite', function () {
        this.timeout(30000);

        before(function (done) {
            this.publicTravis = new TravisCi({
                version: '2.0.0'
            });
            this.privateTravis = new TravisCi({
                version: '2.0.0'
            });
            this.privateTravis.auth.github({
                github_token: process.env.GITHUB_OAUTH_TOKEN
            }, function (err, res) {
                if (err) { return done(new Error(err)); }
                this.privateTravis.authenticate({
                    access_token: res.access_token
                }, function (err) {
                    if (err) { return done(new Error(err)); }

                    done();
                });
            }.bind(this));
        });

        var routesPath = path.resolve(__dirname, '../api/v2.0.0/routes.json');
        var routes = JSON.parse(fs.readFileSync(routesPath).toString());

        _.each(routes, function (routeSection) {
            var routeSectionTestsPath = path.resolve(__dirname, 'endpoints', routeSection.name.toLowerCase());
            var routeSectionEndpointTests = require(routeSectionTestsPath);

            // verify that we don't have any tests defined for this route section that aren't necessary
            // ie, tests that were written for routes that no longer exists.
            // this will help us detect variable name changes in the route def
            var unnecessaryTests = _.filter(routeSectionEndpointTests, function (section) {
                return !_.findWhere(routeSection.routes, _.pick(section, 'uri', 'verb'));
            });
            if (unnecessaryTests.length > 0) {
                _.each(unnecessaryTests, function (unnecessaryTest) {
                    it('tests for unnecessary tests', function () {
                        throw new Error('test for ' + unnecessaryTest.uri + ' - ' + unnecessaryTest.verb + ' is unnecessary');
                    });
                });
                return;
            }

            // for each route, verify that there is a test written for it
            // and if that test exists, run it
            _.each(routeSection.routes, function (route) {
                var testName = 'tests ' + route.verb + ' ' + route.uri;
                
                var routeSectionTestRunner = _.findWhere(routeSectionEndpointTests, {
                    uri: route.uri,
                    verb: route.verb
                });
                if (!routeSectionTestRunner) {
                    it(testName, function () {
                        throw new Error('no test for ' + route.uri + ' ' + route.verb + ' in ' + routeSectionTestsPath);
                    });
                    return;
                }
                routeSectionTestRunner.tests();
            });
        });
    });
});
