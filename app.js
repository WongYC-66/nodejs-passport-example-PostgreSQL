/////// app.js

const pg = require('pg');
const express = require("express");
// const session = require("express-session");
const expressSession = require('express-session');
const pgSession = require('connect-pg-simple')(expressSession);

const passport = require("passport");
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs')

const pgPool = new pg.Pool({
    // add your configuration
    connectionString: 'postgresql://admin1:admin1@localhost:5432/user_auth'
});

const app = express();
app.set("views", __dirname);
app.set("view engine", "ejs");

// app.use(session({ secret: "cats", resave: false, saveUninitialized: false }));
app.use(expressSession({
    store: new pgSession({
        pool: pgPool,                // Connection pool
        tableName: 'session'   // Use another table-name than the default "session" one
        // Insert connect-pg-simple options here
    }),
    secret: 'cats',
    saveUninitialized: false,
    resave: false,
    cookie: { maxAge: 1 * 24 * 60 * 60 * 1000 } // 30 days
    // Insert express-session options here
}));



app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

passport.use(
    new LocalStrategy(async (username, password, done) => {
        try {

            const { rows } = await pgPool.query("SELECT * FROM users WHERE username = $1", [username]);
            const user = rows[0];

            if (!user) {
                return done(null, false, { message: "Incorrect username" });
            };

            const match = await bcrypt.compare(password, user.password);

            if (!match) {
                // passwords do not match!
                return done(null, false, { message: "Incorrect password" })
            }

            return done(null, user);
        } catch (err) {
            return done(err);
        };
    })
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const { rows } = await pgPool.query("SELECT * FROM users WHERE id = $1", [id]);
        const user = rows[0];

        done(null, user);
    } catch (err) {
        done(err);
    };
});


app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
});

app.get("/", (req, res) => {
    res.render("index", { user: req.user })
});
app.get("/sign-up", (req, res) => res.render("sign-up-form"));
app.post("/sign-up", async (req, res, next) => {
    try {

        bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
            // if err, do something
            // otherwise, store hashedPassword in DB

            await pgPool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [
                req.body.username,
                hashedPassword,
            ]);
            res.redirect("/");
        });


    } catch (err) {
        return next(err);
    };
});

app.post(
    "/log-in",
    passport.authenticate("local", {
        successRedirect: "/",
        failureRedirect: "/"
    })
);

app.get("/log-out", (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect("/");
    });
});

app.listen(3000, () => console.log("app listening on port 3000!"));

