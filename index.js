const express = require('express');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const https = require('https'); // Using https so i don't use external libs
const db = require('./models');

const app = express();

app.use(bodyParser.json());
app.use(express.static(`${__dirname}/static`));

app.get('/api/games', async (req, res) => {
  try {
    const games = await db.Game.findAll()
    return res.send(games)
  } catch (err) {
    console.error('There was an error querying games', err);
    return res.send(err);
  }
})

app.post('/api/games', async (req, res) => {
  const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
  try {
    const game = await db.Game.create({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
    return res.send(game)
  } catch (err) {
    console.error('***There was an error creating a game', err);
    return res.status(400).send(err);
  }
})

app.post('/api/games/search', async (req, res) => {
  const { name, platform } = req.body;
  try {
    const games = await db.Game.findAll({ where: {
      name: { [Sequelize.Op.like]: `%${name}%` },
      platform: platform || { [Sequelize.Op.ne]: platform },
    }})
    return res.send(games)
  } catch (err) {
    console.error('***There was an error looking for this game', err);
    return res.status(400).send(err);
  }
})

const requestS3 = async (url) => { // Temp
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      res.setEncoding('utf8');
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        resolve(JSON.parse(responseBody));
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

app.post('/api/games/populate', async (req, res) => {
  const urls = [
    'https://interview-marketing-eng-dev.s3.eu-west-1.amazonaws.com/android.top100.json', //It may be top 300
    'https://interview-marketing-eng-dev.s3.eu-west-1.amazonaws.com/ios.top100.json'
  ]
  try {
    const gameListSplited = await Promise.all([requestS3(urls[0]), requestS3(urls[1])])
    const gameList = gameListSplited[0].concat(gameListSplited[1]);
    console.log(gameList[1]);
    const fixedList = gameList.map((el) => {
      const obj = {
        id: el.app_id,
        publisherId: el.publisher_id,
        name: el.name,
        platform: el.os,
        bundleId: el.bundle_id,
        appVersion: el.version,
        isPublished: true,
        createdAt: el.release_date,
        updatedAt: el.updated_date,
      }
      // console.log({el});
      return obj
    })
    // const games = await db.Game.bulkCreate(fixedList);
    console.log(fixedList[0]);
    return res.send('OK')
  } catch (err) {
    console.error('***There was an error looking for this game', err);
    return res.status(400).send(err);
  }
})

app.delete('/api/games/:id', async (req, res) => {
  try {
    const game = await db.Game.findByPk(parseInt(req.params.id))
    await game.destroy({ force: true })
    return res.send({ id: game.id  })
  } catch (err) {
    console.error('***Error deleting game', err);
    return res.status(400).send(err);
  }
});

app.put('/api/games/:id', async (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
  try {
    const game = await db.Game.findByPk(id)
    await game.update({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
    return res.send(game)
  } catch (err) {
    console.error('***Error updating game', err);
    return res.status(400).send(err);
  }
});

app.listen(3000, () => {
  console.log('Server is up on port 3000');
});

module.exports = app;
