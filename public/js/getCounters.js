// GetCounters.js
"use strict";

angular.module('nhGetCounters')
  .factory('getCountersFactory', function($interval, $log) {
    //---- helper functions for obtaining an interface's bps --------- 
    var bpsConverter = {};

    // create counter collection 
    var counterQueryCollection = [];

    // ------------------------------------------------
    // 
    // the interfaces data returned by the inView API is an array of structs.  
    // The following is this struct's json: 
    // 
    // {
    //  "intefaces": [
    //    {
    //      "Index": 1,
    //      "ifInOctets": 75854877,
    //      "ifOutOctets": 19907210
    //    },
    //   ...
    //  ]}
    // 
    //  
    // interfaceId is the string assigned to a given index in 
    //              this array of indexes. In the above json fragment 
    //              the interfaceId at array location zero is "1"
    // 
    // interfaceNdx is the interface array index.  
    // 
    // ------------------------------------------------


    // calculateTotalBits( currentReading, previousReading )
    //      calculates the difference between the specified readings.
    //      Assumes 32bit counters.  Handles the case where a 
    //      32 bit counter rolled over.
    // 
    bpsConverter.calculateTotalBits = function(currentReading, previousReading) {
      var retval = 0;

      // BUG: cannot detect counter that rolled-over multiple times

      // if the interface's counter rolled over
      if (currentReading < previousReading) {
        // calcuate the bits required to cause the roll-over
        retval = Math.pow(2, 31) - previousReading;

        // then add-in the bits that passed since the roll-over
        retval += currentReading;

      } else { // the interface's counter didn't roll over
        // then just calculate the difference
        retval = currentReading - previousReading;
      }

      // readings obtained via the getCounters API are in terms of bytes per second

      // convert bytes per second to bits per second
      retval *= 8;

      return retval;
    };


    // getTotalBits(interfaceNdx)
    //      returns the number of bits transmitted on the specified interface.
    //      
    //      Correctly handles the case where the interface's 32 bit counter rolls over.
    // 
    //      parameters
    //      interfaceNdx -- the location in the array of 
    //                      interface readings for the specified interface.  
    //                      This is an integer value

    bpsConverter.getTotalBits = function(interfaceNdx) {
      var retval = {};

      // if we failed to limit the collection to two items
      if (counterQueryCollection.length > 2) {
        // then the system has some sort of logic error
        throw new Error("logic error: counterQueryCollection.length > 2")
      }

      var currentReading = counterQueryCollection[0].intefaces[interfaceNdx];
      var previousReading = counterQueryCollection[1].intefaces[interfaceNdx];

      retval.totalInboundBits = bpsConverter.calculateTotalBits(currentReading.ifInOctets, previousReading.ifInOctets);
      retval.totalOutboundBits = bpsConverter.calculateTotalBits(currentReading.ifOutOctets, previousReading.ifOutOctets);

      // return an array that only contains readings pertaining to the specified interface
      return retval;
    };



    // TODO Factor ioDirection into a general purpose utilty js. 
    // Other modules will need this same functionality and we want to keep things DRY
    // an "enumeration" that specifies I/O direction 
    var ioDirection = {
      IN: 0,
      OUT: 1,
      BIDIRECTIONAL: 2
    };

    // getMsDuration( start, stop )
    // 
    //      returns the total number of ms between the start and stop times
    // 
    //  parameters
    // 
    //      start -- begining of duration (least current time)
    //      stop  -- end of duration      (most current time)
    // 
    var getMsDuration = function(start, stop) {
      var retval = 0;

      var earliestReadingTimestamp = moment(start);
      var oldestReadingTimestamp = moment(stop);

      // moment.diff() returns results in terms of ms
      retval = oldestReadingTimestamp.diff(earliestReadingTimestamp);

      // rount result to the nearest integer
      return Math.round(retval);
    }



    // getInterfaceBitsPerSecond( interfaceNdx )
    //
    //      returns rate that inbound bits are received, in terms of bits per second, 
    //      by the specified interface 
    // 
    //  parameters:
    // 
    //      interfaceNdx -- the location in the array of 
    //                      interface readings for the specified interface.  
    //                      This is an integer value
    // 
    bpsConverter.getInterfaceBitsPerSecond = function(interfaceNdx, direction) {
      //$log.info('in bpsConverter.getInterfaceBitsPerSecond()');

      // commentary:  The array of readings is comprised of two 
      //              items:
      //                  1) the most recent reading
      //                  2) the next most recent
      // 
      //              The bps calcuation is the difference between these
      //              two values divided by the duration in seconds between
      //              these two readings.
      // 
      var retval = 0;

      // the number of readings must be exactly two

      // if we do not have the correct number of readings return 0 bps
      if (counterQueryCollection.length === 2) {

        var interFaceBits = bpsConverter.getTotalBits(interfaceNdx);
        var msDuration = getMsDuration(counterQueryCollection[1].timestamp, counterQueryCollection[0].timestamp);

        if (direction === ioDirection.IN) {
          retval = interFaceBits.totalInboundBits / msDuration;
        } else {
          retval = interFaceBits.totalOutboundBits / msDuration;
        }

        // normalize to seconds
        retval *= 1000;
      }

      // return the number of bits per second on this interface 
      return retval;
    };

    //---- end of interface's bps helper functions ---------


    // tossObsoleteReadings()
    //
    //      scans the counterQueryCollection array and removes 
    //      any readings that are obsolete
    // 
    //$scope.tossObsoleteReadings = function () {
    var tossObsoleteReadings = function() {

      // current rule is to retain both the latest reading and 
      // the one prior to the latest
      counterQueryCollection = counterQueryCollection.splice(0, 2);
    };


    return {

      // destroy the collection of counter readings
      flushCounterQueryCollection: function() {
        counterQueryCollection = []; // toss collected data
      },

      getInboundBitsPerSecond: function(interfaceNdx) {
        return bpsConverter.getInterfaceBitsPerSecond(interfaceNdx, ioDirection.IN);
      },

      getOutboundBitsPerSecond: function(interfaceNdx) {
        return bpsConverter.getInterfaceBitsPerSecond(interfaceNdx, ioDirection.OUT);
      },

      processCounterData: function(counterData) {
        //console.info( JSON.stringify(counterData) );
        // append most recently obtained counter metrics to array of counter metrics
        counterQueryCollection.unshift(counterData);

        // discard any readings that are old enough to be ignored
        //$scope.tossObsoleteReadings();
        tossObsoleteReadings();
      }
    }
  });
