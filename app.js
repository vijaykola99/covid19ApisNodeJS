const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    process.exit(1);
    console.log("DB Error");
  }
};
initializeDBAndServer();

//Authenticate Token

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRETE_CODE", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//Login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userDetailsQuery = ` 
  SELECT 
  * 
  FROM 
  user 
  WHERE 
  username = '${username}';`;
  const userDetails = await db.get(userDetailsQuery);
  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordValidate = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (passwordValidate) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRETE_CODE");
      response.send({ jwtToken });
    } else {
      response.send("Invalid password");
    }
  }
});

//GET states API

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = ` 
    SELECT 
    * 
    FROM 
    state  
    ORDER BY state_id;`;
  const statesData = await db.all(getStatesQuery);
  response.send(
    statesData.map((eachState) => ({
      stateId: eachState.state_id,
      stateName: eachState.state_name,
      population: eachState.population,
    }))
  );
});

//GET state API

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = ` 
    SELECT 
    * 
    FROM 
    state 
    WHERE 
    state_id = '${stateId}';`;
  const stateData = await db.get(getStateQuery);
  response.send({
    stateId: stateData.state_id,
    stateName: stateData.state_name,
    population: stateData.population,
  });
});

//POST districts API

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const districtAddQuery = ` 
  INSERT INTO 
  district (district_name,state_id,cases,cured,active,deaths)
  VALUES(
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
  );`;
  await db.run(districtAddQuery);
  response.send("District Successfully Added");
});

//GET district API

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDataQuery = ` 
    SELECT 
    * 
    FROM 
    district 
    WHERE district_id=${districtId};`;
    const districtData = await db.get(districtDataQuery);
    response.send({
      districtId: districtData.district_id,
      districtName: districtData.district_name,
      stateId: districtData.state_id,
      cases: districtData.cases,
      cured: districtData.cured,
      active: districtData.active,
      deaths: districtData.deaths,
    });
  }
);

//Delete district API 6

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `  
  DELETE FROM district 
  WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//PUT districts API 7

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateSqlQuery = ` 
      UPDATE 
      district 
      SET 
      district_name='${districtName}',
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths = ${deaths}
      WHERE 
      district_id = ${districtId};`;
    await db.run(updateSqlQuery);
    response.send("District Details Updated");
  }
);

//GET states API

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statesQuery = ` 
      SELECT 
      SUM(cases) AS totalCases,
      SUM(cured) AS totalCured,
      SUM(active) AS totalActive,
      SUM(deaths) AS totalDeaths
      FROM 
      district
      WHERE 
      state_id = ${stateId};`;
    const data = await db.get(statesQuery);
    response.send(data);
  }
);

module.exports = app;
