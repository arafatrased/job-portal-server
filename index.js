const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const app = express()
require('dotenv').config();

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');


//Middleware

app.use(cors({
  origin:['http://localhost:5173'],
  credentials: true // enable cookie to set in react client
}));
app.use(express.json());
app.use(cookieParser())


// Auth Middleware
const logger = (req, res, next) => {
  console.log('logger middleware')
  next();
};

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send('Access Denied');
  }
  try {
    const verified = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(403).send('Forbidden');
  }
}



//jobportalbro
//00m3sJMVsjiLFwX8


const uri = `mongodb+srv://${process.env.JOBPORTAL_USER}:${process.env.JOBPORTAL_PASS}@cluster0.7szto.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const jobsCollection = client.db('jobPortal').collection('jobs');
    const jobApplicationCollection = client.db('jobPortal').collection('job_applications');

    //Authentication apis
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    })

    app.post('/logout', async (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: false,

      }).send({ success: true });
    });


    app.get('/jobs', async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query = { hr_email: email };
      }
      const cursor = jobsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });


    app.get('/jobs/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });
    app.get('/job-application', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email }
      const result = await jobApplicationCollection.find(query).toArray();
      console.log(req.cookies?.token);
      //tocken email and query email should be same
      if(req.user.email !== req.query.email){
        return res.status(403).send('Forbidden Access');
      }

      // fokira way to aggregate data
      for (const application of result) {
        // console.log(application.job_id)
        const query1 = { _id: new ObjectId(application.job_id) }
        const job = await jobsCollection.findOne(query1);
        if (job) {
          application.title = job.title;
          application.location = job.location;
          application.company = job.company;
          application.company_logo = job.company_logo;
        }
      }

      res.send(result);
    });

    app.get('/job-applications/jobs/:job_id', async (req, res) => {
      const jobId = req.params.job_id;
      const query = { job_id: jobId }
      const result = await jobApplicationCollection.find(query).toArray();
      res.send(result);
    })


    app.post('/job-applications', async (req, res) => {
      const application = req.body;
      const result = await jobApplicationCollection.insertOne(application);

      

      // Not the best way (use aggregate) 
      // skip --> it
      const id = application.job_id;
      const query = { _id: new ObjectId(id) }
      const job = await jobsCollection.findOne(query);
      let newCount = 0;
      if (job.applicationCount) {
        newCount = job.applicationCount + 1;
      }
      else {
        newCount = 1;
      }

      // now update the job info
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          applicationCount: newCount
        }
      }

      const updateResult = await jobsCollection.updateOne(filter, updatedDoc);

      res.send(result);
    });

    // Post Job
    app.post('/jobs', async (req, res) => {
      const newData = req.body;
      const result = await jobsCollection.insertOne(newData);
      res.send(result);
    })

    app.patch('/job-applications/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: data.status
        }
      }
      const result = await jobApplicationCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Job is waiting at: ${port}`)
})