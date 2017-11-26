'use strict';
var ifViewApp = angular.module('ifViewApp', ['ui.bootstrap', 'nhGetCounters']);

//  function ifViewCtrl($scope, $location, $http, $log) {
ifViewApp.controller('ifViewCtrl',
  function($scope,
    $location,
    $http,
    $log,
    $interval,
    $window, // for moment.js
    getCountersFactory) {

    // create a blank object to hold our form information
    $scope.formData = {};

    // create a blank object to hstore API parameters
    $scope.APIParameters = {};


    // A timer controls the interval between polling for 
    // snmp device counters.  We need to store the timer's 
    // ID so that we can control it
    var snmpDevicePollIntervalTimerId = undefined;



    //------------ setup spinner control stuff ---------
    $scope.interfaceTable = {};
    $scope.interfaceTableSpinner = {};
    $scope.interfaceTable = document.getElementById('interfaceTable');
    $scope.interfaceTableSpinner = new Spinner().spin($scope.interfaceTable);
    //------------ end of spinner setup ---------

    $scope.queryInprogress = false;

    $scope.processCounterData = getCountersFactory.processCounterData;
    $scope.flushCounterQueryCollection = getCountersFactory.flushCounterQueryCollection;
    $scope.getInboundBitsPerSecond = getCountersFactory.getInboundBitsPerSecond;
    $scope.getOutboundBitsPerSecond = getCountersFactory.getOutboundBitsPerSecond;



    // initiate periodic polling of the snmp device's bytes sent/received counters
    $scope.startPollingCounters = function() {
        var pollingInterval = 3000; // in ms
        // 
        snmpDevicePollIntervalTimerId = $interval(function() {
            return $scope.getCounters();
          },
          pollingInterval);
      },

      // Terminate periodic polling of the snmp device's bytes sent/received counters
      $scope.stopPollingCounters = function() {
        // if the timer's ID is still valid
        if (angular.isDefined(snmpDevicePollIntervalTimerId)) {
          // then stop polling the device
          $interval.cancel(snmpDevicePollIntervalTimerId);
          snmpDevicePollIntervalTimerId = undefined;
          $scope.flushCounterQueryCollection();
        }
      },

      $scope.getInterfaceIdList = function() {

        var retval = [];
        var elementCount = $scope.device.intefaces.length;

        for (var ndx = 0; ndx < elementCount; ndx++) {
          retval.push($scope.device.intefaces[ndx].Index);
        }

        return retval;
      }


    $scope.getCounters = function() {
      $http.get(
          '/api/getCounters?target=' + $scope.APIParameters.snmpIp +
          '&community=' + $scope.APIParameters.snmpCommunity +
          '&version=' + $scope.APIParameters.snmpVersion)
        .success(function(data) {
          // send interface counter data into the mill
          $scope.processCounterData(data);

          var maxInterfaceNdx = $scope.device.intefaces.length;

          // iterate list of interfaces
          for (var ndx = 0; ndx < maxInterfaceNdx; ndx++) {
            // update interface list with ave bit rates
            $scope.device.intefaces[ndx].aveInboundBps = $scope.getInboundBitsPerSecond(ndx);
            $scope.device.intefaces[ndx].aveOutboundBps = $scope.getOutboundBitsPerSecond(ndx);
          }


          $scope.alerts = []; // remove any presented alerts on success
        })
        .error(function(data, status, headers, config) {
          $scope.addAlert(status + ': ' + data);
          $log.warn('getCounters error: ' + status + ': ' + data);
        });
    };

    $scope.getData = function() {

      $scope.queryInprogress = true;

      $http.get(
          '/api/getInterfaces?target=' + $scope.APIParameters.snmpIp +
          '&community=' + $scope.APIParameters.snmpCommunity +
          '&version=' + $scope.APIParameters.snmpVersion)
        .success(function(data) {
          $scope.device = data;
          $scope.alerts = []; // remove any presented alerts on success
          $scope.queryInprogress = false;

          // if we aren't polling the snmp device's counters
          if (angular.isUndefined(snmpDevicePollIntervalTimerId)) {
            $scope.startPollingCounters();
          }

        })
        .error(function(data, status, headers, config) {
          $scope.device = {};
          $scope.addAlert(status + ': ' + data);
          $scope.queryInprogress = false;

          // if we are polling the snmp device's counters
          if (angular.isDefined(snmpDevicePollIntervalTimerId)) {
            $scope.stopPollingCounters();
          }

          $log.warn('getData error: ' + status + ': ' + data);
        });
    }

    $scope.$on('$locationChangeStart', function(event, next, current) {
      // if the location contains four elements
      if ($location.path().split('/').length == 4) {

        // note: $location.path().split('/')[0] == '#', so the 
        // first of the 'four elements' is just boilerplate that we ignore

        // then crack the location and assign the elements to formData variables 
        $scope.formData.snmpVersion = decodeURIComponent($location.path().split('/')[1]);
        $scope.formData.snmpCommunity = decodeURIComponent($location.path().split('/')[2]);
        $scope.formData.snmpIp = decodeURIComponent($location.path().split('/')[3]);

        // then crack the location and assign the elements to formData variables 
        $scope.APIParameters.snmpVersion = $scope.formData.snmpVersion;
        $scope.APIParameters.snmpCommunity = $scope.formData.snmpCommunity;
        $scope.APIParameters.snmpIp = $scope.formData.snmpIp;

        // now that the snmp device's details are known we can query said device. 
        $scope.getData();
      } else {
        $scope.formData.snmpVersion = '1';
        $scope.APIParameters.snmpVersion = '1';
      }

      // if we change the location then we need to terminate polling of the previous device
      // if we are polling the snmp device's counters
      if (angular.isDefined(snmpDevicePollIntervalTimerId)) {
        $scope.stopPollingCounters();
      }

      var startSpinner = function() {
        document.body.appendChild($scope.interfaceTable);
        $scope.interfaceTableSpinner.spin($scope.interfaceTable);
      }

      var stopSpinner = function() {
        $scope.interfaceTableSpinner.stop();
        if ($scope.interfaceTable.parentNode !== null) {
          $scope.interfaceTable.parentNode.removeChild($scope.interfaceTable);
        }
      }

      // Be advised that this use of a $watch() is arguably not a best practice.
      // In my opinion, a better technique would for the .success()/.error() 
      // promises to directly call the startSpinner()/stopSpinner().  I think
      // that using  $watch() to do this work, via monitoring queryInprogress, is 
      // just a roundabout way of calling startSpinner()/stopSpinner().  
      // 
      // The intent of using $watch() in this way is just to demostrate our 
      // abilty to successfully implment a usage of $watch().
      $scope.$watch(
        function() {
          return $scope.queryInprogress
        },
        function() {
          // if a query has just began
          if ($scope.queryInprogress === true) {
            startSpinner();
          } else { // a query has just completed
            stopSpinner();
          }
        },
        true // evaluate $scope.queryInprogress wrt value instead of reference
      );
    });

    // processForm() 
    //     Updates the $location with the IP address, etc., specified in the controls.
    //     Updating the $location automatically modifies the query string aspect of the URI.
    //     The function locationChangeStart() is rigged to automatically fire when the URI changes. 
    //     So, put another way, calling processForm() fires locationChangeStart(). 
    //
    $scope.processForm = function() {
      // location encoding == #/snmp-version/community/snmp-device-IP
      var urlPath = '/' + encodeURIComponent($scope.formData.snmpVersion) +
        '/' + encodeURIComponent($scope.formData.snmpCommunity) +
        '/' + encodeURIComponent($scope.formData.snmpIp);

      $location.path(urlPath);
    }

    $scope.alerts = [];

    $scope.addAlert = function(Msg) {
      $scope.alerts.push({
        type: 'danger',
        msg: Msg
      });
    };

    $scope.closeAlert = function(index) {
      $scope.alerts.splice(index, 1);
    };

    $scope.interfaceRowClass = function(ifOperStatus) {
      switch (ifOperStatus) {
        case 1:
          return '';
        case 2:
          return 'warning';
        default:
          return 'danger';
      }
    };

  }).filter('toBPS', function() {
  return function(bytes, precision) {
    if (bytes == 0) return '0';
    if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
    if (typeof precision === 'undefined') precision = 1;
    if (bytes == 1544000) precision = 3;
    var units = ['bps', 'kbps', 'Mbps', 'Gbps', 'Tbps'];
    var number = Math.floor(Math.log(bytes) / Math.log(1000));
    return (bytes / Math.pow(1000, Math.floor(number))).toFixed(precision) + ' ' + units[number];
  }
});
