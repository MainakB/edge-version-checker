const {getChromiumEdgedriver} = require('./dist');

getChromiumEdgedriver().then(v => console.log(v));
