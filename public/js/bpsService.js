// Bits per Second service


angular.module('bps').factory('bpsService', function() {
  return {

    // notPresentable(bps)
    //  returns true if passed a string that cannot be completedly and 
    //          accurately converted into a number.  
    // 
    //  scenario                            returns
    // 
    //  notPresentable(Number.NaN)          true
    //  notPresentable(Infinity)            true
    //  notPresentable(-Infinity)           true
    //  notPresentable("123.45balloon")     true
    //  notPresentable("123.45")            false
    //  notPresentable('1')                 false
    //  notPresentable(9007199254740992)    false
    //  notPresentable(-9007199254740992)   false
    // 
    notPresentable: function(bps) {

      // init to presentable
      var returnVal = false;

      // if the byte-value cannot be presented as a number
      if (isNaN(parseFloat(bps)) || !isFinite(bps)) {
        // then there is no way to present this value as a number
        returnVal = true;
      } else {
        if (typeof(bps) === "number") {
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
        } else if (typeof(bps) === "string") {
          var numberizedBPS = parseFloat(bps);
          var stringizedBPS = numberizedBPS.toString();

          if (stringizedBPS !== bps) {
            // then this must not be number
            returnVal = true;
          }
        } else { // if it is neither a string nor a number
          // then I better flag it as unpresentable
          returnVal = true;
        }
      }


      return returnVal;
    },


    // calculateExponent()
    //      calculateExponent() is a helper function that 
    //      Calculate the exponent to be used for scaling Bits Per Second (BPS) to 
    //      by powers of 1000.  
    calculateExponent: function(bps) {
      // init to scaling exponent suitable for  bps === 0
      var retval = 0;

      // if the caller specified a negative bit rate
      if (bps < 0) {
        // then throw an exception when an impossible bit rate is encountered
        throw {
          name: 'out of range',
          throwsite: 'calculateExponent()',
          message: 'negative bit rate: ' + bps
        };
      }

      // if we have a non-zero bit rate
      if (bps !== 0) {
        // calculate the scaling exponent
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


      // Ben's policy is to force a particular precision for T1s.
      // Note: T1 trunks operate at 1.54 Mhz
      // 
      // if this appears to be a T1 interface
      if (bps == 1544000) {
        // then force the policy-specified precision that is to be provided for T1s.  
        precision = 3;
      } else {
        // no policy-specified precision values are required 
        //
        // calculate a desired precision using default algorithm.
        precision = this.calculatePrecision(bps, precision); // can throw
      }

      // 
      // The value returned by calculateExponent() is shown by the following table:
      //      Bits Per Second (bps)                  scalingExponent     SI Prefixed Unit
      //                  0   :             999           0                  bps
      //              1,000   :         999,999           1                  kbps
      //          1,000,000   :     999,999,999           2                  Gbps
      //      1,000,000,000   : 999,999,999,999           3                  Tbps
      //
      //  The scalingExponent returns by calculateExponent() is used to select the appropriate
      //  SI Prefixed Unit designation from the units array.
      // 
      var scalingExponent = this.calculateExponent(bps);

      return (bps / Math.pow(1000, Math.floor(scalingExponent))).toFixed(precision) + ' ' + units[scalingExponent];
    }

  }
});
