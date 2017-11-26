var snmp = require('net-snmp');
var util = require('util');
var _ = require('underscore');
var moment = require('moment');

function pollDeviceDetails(session, device, pollCb) {

  var oids = ['1.3.6.1.2.1.1.5.0', '1.3.6.1.2.1.1.6.0', '1.3.6.1.2.1.1.4.0'];
  session.get(oids, function(error, varbinds) {
    if (error) {
      pollCb(error, null);
    } else {
      for (var i = 0; i < varbinds.length; i++) {
        if (snmp.isVarbindError(varbinds[i])) {
          console.error(snmp.varbindError(varbinds[i]));
          return;
        }
      }

      device.name = varbinds[0].value.toString();
      device.location = varbinds[1].value.toString();
      device.contact = varbinds[2].value.toString();

      pollDeviceInterfaces(session, device, pollCb);
    }
  });
}

function sortInt(a, b) {
  if (a > b)
    return 1;
  else if (b > a)
    return -1;
  else
    return 0;
}

function pollDeviceInterfaces(session, device, pollCb) {

  var ifTableOID = '1.3.6.1.2.1.2.2';
  var ifTableColumns = {
    1: 'Index',
    2: 'ifDescr',
    5: 'ifSpeed',
    8: 'ifOperStatus'
  };
  session.tableColumns(ifTableOID, _.keys(ifTableColumns), function(error, table) {
    if (error) {
      pollCb(error, null);
    } else {

      device.intefaces = [];
      var indexes = [];
      for (index in table)
        indexes.push(parseInt(index));
      indexes.sort(sortInt);

      for (var i = 0; i < indexes.length; i++) {
        // Like indexes we sort by column, so use the same trick here,
        // some rows may not have the same columns as other rows, so
        // we calculate this per row
        var columns = [];
        for (column in table[indexes[i]]) {
          columns.push(parseInt(column));
        }
        columns.sort(sortInt);

        var current_inteface = {};
        for (var j = 0; j < columns.length; j++) {
          switch (ifTableColumns[columns[j]]) {
            case 'Index':
              current_inteface[ifTableColumns[columns[j]]] = parseInt(table[indexes[i]][columns[j]]);
              break;
            case 'ifSpeed':
              current_inteface[ifTableColumns[columns[j]]] = parseInt(table[indexes[i]][columns[j]]);
              break;
            case 'ifOperStatus':
              current_inteface[ifTableColumns[columns[j]]] = parseInt(table[indexes[i]][columns[j]]);
              break;
            default:
              current_inteface[ifTableColumns[columns[j]]] = '' + table[indexes[i]][columns[j]];
          }
        }
        device.intefaces.push(current_inteface);
      }
      pollAliases(session, device, pollCb);
    }
  });
}

function pollCounters(session, counters, pollCb) {

  var ifTableOID = '1.3.6.1.2.1.2.2';
  var ifTableColumns = {
    1: 'Index',
    10: 'ifInOctets',
    16: 'ifOutOctets'
  };
  session.tableColumns(ifTableOID, _.keys(ifTableColumns), function(error, table) {
    if (error) {
      pollCb(error, null);
    } else {

      counters.intefaces = [];
      var indexes = [];
      for (index in table)
        indexes.push(parseInt(index));
      indexes.sort(sortInt);

      for (var i = 0; i < indexes.length; i++) {
        var columns = [];
        for (column in table[indexes[i]]) {
          columns.push(parseInt(column));
        }
        columns.sort(sortInt);

        var current_inteface = {};
        for (var j = 0; j < columns.length; j++) {
          switch (ifTableColumns[columns[j]]) {
            case 'Index':
              current_inteface[ifTableColumns[columns[j]]] = parseInt(table[indexes[i]][columns[j]]);
              break;
            case 'ifInOctets':
              current_inteface[ifTableColumns[columns[j]]] = parseInt(table[indexes[i]][columns[j]]);
              break;
            case 'ifOutOctets':
              current_inteface[ifTableColumns[columns[j]]] = parseInt(table[indexes[i]][columns[j]]);
              break;
            default:
              current_inteface[ifTableColumns[columns[j]]] = '' + table[indexes[i]][columns[j]];
          }
        }
        counters.intefaces.push(current_inteface);
      }
      counters.timestamp = moment();
      pollCb(null, counters);
    }
  });
}

function pollAliases(session, device, pollCb) {

  var ifXTableOID = '1.3.6.1.2.1.31.1.1';
  var ifXTableOIDColumns = {
    1: 'ifName',
    18: 'ifAlias'
  };
  session.tableColumns(ifXTableOID, _.keys(ifXTableOIDColumns), function(error, table) {
    if (error) {
      // No data, nothing to do
      console.warn('No ifXTable data ' + error);
      pollCb(null, device);
    } else {
      var indexes = [];
      for (index in table) {
        indexes.push(parseInt(index));
      }
      indexes.sort(sortInt);
      for (var i = 0; i < indexes.length; i++) {
        var columns = [];
        for (column in table[indexes[i]]) {
          columns.push(parseInt(column));
        }
        columns.sort(sortInt);
        for (var j = 0; j < columns.length; j++) {
          device.intefaces[i][ifXTableOIDColumns[columns[j]]] = '' + table[indexes[i]][columns[j]];
        }
      }
      pollCb(null, device);
    }
  });
}

function pollDevice(session, device, pollCb) {
  pollDeviceDetails(session, device, pollCb);
}

exports.get = function(req, res) {
  var device = {};
  device.sessionParams = {};

  if (!req.query.version) {
    device.sessionParams.versionIndex = snmp.Version1;
  } else {
    switch (req.query.version) {
      case '1':
        device.sessionParams.versionIndex = snmp.Version1;
        break;
      case '2':
        device.sessionParams.versionIndex = snmp.Version2c;
        break;
      default:
        res.send(404, 'Invalid SNMP Version');
        break;
    }
  }
  if (!req.query.target) {
    res.send(404, 'target not specified');
  } else {
    device.sessionParams.target = req.query.target;
  }
  if (!req.query.community) {
    res.send(404, 'community not specified');
  } else {
    device.sessionParams.community = req.query.community;
  }

  var snmpPort = 161;

  if (device.sessionParams.target.split(':')[1]) {
    snmpPort = device.sessionParams.target.split(':')[1];
  }

  var session = snmp.createSession(
    device.sessionParams.target.split(':')[0],
    device.sessionParams.community, {
      version: device.sessionParams.versionIndex,
      port: snmpPort
    }
  );

  pollDevice(session, device, function(error, device) {
    if (error) {
      res.send(404, error.toString());
    } else {
      res.send(device);
    }
  });
}

exports.getCounters = function(req, res) {
  var device = {};
  device.sessionParams = {};

  if (!req.query.version) {
    device.sessionParams.versionIndex = snmp.Version1;
  } else {
    switch (req.query.version) {
      case '1':
        device.sessionParams.versionIndex = snmp.Version1;
        break;
      case '2':
        device.sessionParams.versionIndex = snmp.Version2c;
        break;
      default:
        res.send(404, 'Invalid SNMP Version');
        break;
    }
  }
  if (!req.query.target) {
    res.send(404, 'target not specified');
  } else {
    device.sessionParams.target = req.query.target;
  }
  if (!req.query.community) {
    res.send(404, 'community not specified');
  } else {
    device.sessionParams.community = req.query.community;
  }

  var snmpPort = 161;

  if (device.sessionParams.target.split(':')[1]) {
    snmpPort = device.sessionParams.target.split(':')[1];
  }

  var session = snmp.createSession(
    device.sessionParams.target.split(':')[0],
    device.sessionParams.community, {
      version: device.sessionParams.versionIndex,
      port: snmpPort
    }
  );

  pollCounters(session, {}, function(error, counters) {
    if (error) {
      res.send(404, error.toString());
    } else {
      res.send(counters);
    }
  });
}
