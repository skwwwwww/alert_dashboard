package db

import (
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init() error {
	var err error

	// Use local database in backend directory
	dbPath := "./alerts_v2.db"
	log.Printf("Connecting to database at: %s", dbPath)

	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return err
	}

	log.Println("Database connection established")

	// Run migration to ensure schema is up to date
	log.Println("Running database migration...")
	if err := MigrateDatabase(DB); err != nil {
		log.Printf("Migration error: %v", err)
		return err
	}

	return nil
}
