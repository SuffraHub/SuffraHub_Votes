const express = require('express')
const app = express()
const port = 8004

app.get('/', (req, res) => {
  res.send('Hello World! from votes API')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

