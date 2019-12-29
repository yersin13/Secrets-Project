//jshint esversion:6
require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
//// Set dependans of session, passport and passport local mogoose.///
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
//const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();
/// const for express validator///
const {
    check,
    validationResult,
    body
} = require('express-validator');


app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static("public"));


/// set app.use for session

app.use(session({
    secret: "Our Little secret.",
    resave: false,
    saveUninitialized: false
}));

///set app.use passport to initilize and session.

app.use(passport.initialize());
app.use(passport.session());
////Use this when mongoDB ist online --->
//mongodb+srv://admin-yersin:eduardo13@cluster0-lzrek.mongodb.net/userDB

///Use this when mongoDB it's local ---> 
//mongodb://localhost:27017/userDB
mongoose.connect("mongodb+srv://admin-yersin:eduardo13@cluster0-lzrek.mongodb.net/userDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

mongoose.set("useCreateIndex", true);

///////

const secretSchema = new mongoose.Schema({
    name: String
});

const Secret = mongoose.model("Secret", secretSchema);

///////

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    secrets: [secretSchema]
});

/// add plugin to UserSchema
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);




const User = new mongoose.model("User", userSchema);



passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});


passport.use(new GoogleStrategy({
        clientID: "904217430952-ek8764qmuo4olarch7q3tbham2h4unbd.apps.googleusercontent.com",
        clientSecret: "FT5R7lAfRW9ac_ZoPJODGY0H",
        callbackURL: "/auth/google/secrets",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({
            googleId: profile.id
        }, function (err, user) {
            return cb(err, user);
        });
    }
));


//passport.use(new FacebookStrategy({
//        clientID: process.env.CLIENT_ID_FB,
//        clientSecret: process.env.CLIENT_SECRET_FB,
//        callbackURL: "http://localhost:3000/auth/facebook/secrets"
//    },
//    function (accessToken, refreshToken, profile, cb) {
//        User.findOrCreate({
//            facebookId: profile.id
//        }, function (err, user) {
//            return cb(err, user);
//        });
//        console.log(accessToken, refreshToken, profile);
//    }
//));
//
//



app.get("/", function (req, res) {
    res.render("home");

});

app.get("/auth/google",
    passport.authenticate("google", {
        scope: ["profile"]
    }));

app.get('/auth/google/secrets',
    passport.authenticate('google', {
        failureRedirect: '/login'
    }),
    function (req, res) {
        // Successful authentication, redirect to secret.
        res.redirect('/secrets');
    });

//app.get('/auth/facebook',
//    passport.authenticate('facebook', {
//        scope: ["profile"]
//    }));
//
//app.get('/auth/facebook/secrets',
//    passport.authenticate('facebook', {
//        failureRedirect: '/login'
//    }),
//    function (req, res) {
//        // Successful authentication, redirect home.
//        res.redirect('/secrets');
//    });



app.get("/login", function (req, res) {
    res.render("login");
});


app.get("/register", function (req, res) {
    res.render("register");
});

app.get("/secrets", function (req, res) {



    User.find({
        "secret": {
            $ne: null
        }
    }, function (err, foundUsers) {
        if (err) {
            console.log(err);
        } else {
            if (foundUsers) {

                Secret.find({}, function (err, secret) {
                    console.log(foundUsers._id);
                    res.render("secrets", {
                        usersWithSecrets: secret
                    });

                });




            }
        }
    });
});

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", function (req, res) {
    const submittedSecret = req.body.secret;

    const userId = req.user.id;

    User.findById(req.user.id, function (err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                const secret = new Secret({
                    name: submittedSecret
                });
                secret.save(function () {
                    User.findOne({
                        _id: userId
                    }, function (err, foundUser) {
                        foundUser.secrets.push(secret);
                        foundUser.save();
                        res.redirect("/secrets");
                    });

                })
            }
        }
    });
});



app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});




app.post("/register", [
    // username must be an email
  check('username').isEmail().normalizeEmail(),

  // password must be at least 5 chars long

   check('password', 'Your password must be at least 5 characters').not().isEmpty().isLength({
        min: 5
    })
], function (req, res) {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(errors)
      res.status(422).json({
            errors: errors.array()
        });
    }

    User.register({
        username: req.body.username
    }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });

        }
    });

});






app.post("/login", function (req, res) {

    const user = new User({
        username: req.body.username,
        password: req.body.password

    });

    req.login(user, function (err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }
    });


});



/// use this when it's local---->
//let port = process.env.PORT;
//if (port == null || port == "") {
//    port = 3000;
//}
//
//app.listen(port, function () {
//    console.log("Server started on port 3000!");
//});


////Use this when it's online ---->

app.listen(process.env.PORT || 5000);
 
