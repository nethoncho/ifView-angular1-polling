// Bits per Second service


angular.module('bps').factory('bpsService', function() {
  return {
    notPresentable: function(bps) {

      // init to presentable
      var returnVal = false;

      // if the byte-value cannot be presented as a number
      if (isNaN(parseFloat(bps)) || !isFinite(bps)) {
        // then there is no way to present this value as a number
        returnVal = true;
      } else {
        // if bps is converted to a string and 
        // back to an number AND originalBPS != derivedBPS 
        // then bps isn't a number and, therefore, we 
        // will deem it "unpresentable"

        var stringizedBPS = bps.toString();
        var numberizedBPS = Number(stringizedBPS);

        if (numberizedBPS !== bps) {
          // then this must not be number
          returnVal = true;
        }
      }


      return returnVal;
    },


    // calculateExponent()
    //      calculateExponent()is a helper function that 
    //      Calculate the exponent to be used for scaling Bits Per Second (BPS) to 
    //      by powers of 1000.  
    calculateExponent: function(bps) {

      // have to init it to something. (Would undefined be better?)
      var retval = 0;

      if (bps === 0) {
        retval = 0;
      } else {

        retval = Math.floor(Math.log(bps) / Math.log(1000));
      }
      return retval;
    },

    // calculatePrecision() 
    //      mostly just validates that 'precision' is valid.
    //      Will force the 'precision' to 3 in the 
    //      special case where the bit rate is the T1 bit rate.
    calculatePrecision: function(bps, precision) {

      // if the caller didn't specify a desired precision 
      if (typeof(precision) === "undefined") {
        // then assign a default precision
        precision = 1;
      } else {

        // if the precision parameter is a string
        if (typeof(precision) == "string") {
          // then we need to verify that precision is a stringized number
          // 
          // if precision is converted to a string and 
          // back to an number AND original value  != derived value
          // then precision isn't a number 
          var stringizedPrecision = precision.toString();
          var numberizedPrecision = Number(stringizedPrecision);

          // if the string passed in the precision parameter is 
          // a well-formed number
          if (numberizedPrecision === Number(precision)) {
            // convert precision to a number
            precision = Number(precision);
          } else {
            throw {
              name: 'not a well-formed number',
              throwsite: 'calculatePrecision()',
              message: 'wild precision parameter value:' + precision
            };
          }
        }

        // if the caller passed an out-of-range value in the precision parameter
        if (precision < 1) {
          // then throw exception when a wild precision is encountered
          throw {
            name: 'out-of-range',
            throwsite: 'calculatePrecision()',
            message: 'wild precision parameter value:' + precision
          };
        }
        // Ben's intent is to force a particular precision for T1s.
        // T1 trunks operate at 1.54 Mhz
        // if this appears to be a T1 interface
        else if (bps == 1544000) {
          // then force the precision that is to be provided for T1s.  
          precision = 3;
        }
      }

      return precision;
    },

    //   formatValue()
    //      renders the bit rate into a pleasing human-readable string.
    //      scales the bit rate as per the caller-specified precision.
    //      decorates the returned string with a unit designator indicating
    //      scaling.  
    formatValue: function(bps, precision) {

      // defend against wild parameters
      if (this.notPresentable(bps)) {
        return '-';
      }

      // if the caller passed an out of range value in the precision parameter
      if (precision < 1) {
        // throw on wild precisions
        throw {
          name: 'out-of-range',
          throwsite: 'formatValue()',
          message: 'wild precision parameter value: ' + precision
        };
      }

      // still here? then the parameters are valid. 

      // if bps' value is "unitless" 
      if (bps == 0) {
        return '0';
      }

      // if we are here then we will need to scale the bps value and decorate it with a "unit"
      // indicating its scaling factor.

      // scaled bps unit indicators prefixed with SI Prefixes indicating increasing powers of 1000 
      //      Citation http://en.wikipedia.org/wiki/Metric_prefix
      var units = ['bps', 'kbps', 'Mbps', 'Gbps', 'Tbps'];

      precision = this.calculatePrecision(bps, precision); // can throw
      var scalingExponent = this.calculateExponent(bps);

      return (bps / Math.pow(1000, Math.floor(scalingExponent))).toFixed(precision) + ' ' + units[scalingExponent];
    }

  }
});
