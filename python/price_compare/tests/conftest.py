import os

# Importing main constructs its default application. Keep that application off
# the real SQLite file; each API test supplies its own temporary database.
os.environ["COMPARE_DATABASE_URL"] = "sqlite://"
os.environ["INVESTMENT_AUTO_UPDATE"] = "false"
