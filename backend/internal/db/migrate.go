package db

import (
	"fmt"
	"os"

	"github.com/nolouch/alerts-platform-v2/internal/models"
	"gorm.io/gorm"
)

// MigrateDatabase performs database schema migration
func MigrateDatabase(db *gorm.DB) error {
	fmt.Println("🔄 Starting database migration...")

	// Check if old schema exists
	if db.Migrator().HasTable("issues") {
		// Check if we have the new schema or old schema
		hasDescription := db.Migrator().HasColumn(&models.Issue{}, "description")
		hasProject := db.Migrator().HasColumn(&models.Issue{}, "project")

		if !hasDescription || !hasProject {
			fmt.Println("⚠️  Old schema detected. Migration required.")
			fmt.Println("📋 This will:")
			fmt.Println("   1. Backup existing data (if any)")
			fmt.Println("   2. Drop old table")
			fmt.Println("   3. Create new table with updated schema")

			// Backup table if it has data
			var count int64
			db.Table("issues").Count(&count)
			if count > 0 {
				backupTable := fmt.Sprintf("issues_backup_%d", int64(os.Getpid()))
				fmt.Printf("💾 Backing up %d records to %s\n", count, backupTable)

				// Rename old table to backup
				if err := db.Exec(fmt.Sprintf("ALTER TABLE issues RENAME TO %s", backupTable)).Error; err != nil {
					return fmt.Errorf("failed to backup table: %w", err)
				}
				fmt.Printf("✅ Backup complete: %s\n", backupTable)
			} else {
				// Drop empty old table
				if err := db.Migrator().DropTable("issues"); err != nil {
					return fmt.Errorf("failed to drop old table: %w", err)
				}
				fmt.Println("🗑️  Dropped empty old table")
			}
		}
	}

	// Create or update table with new schema
	fmt.Println("🔨 Creating/updating table schema...")
	if err := db.AutoMigrate(&models.Issue{}); err != nil {
		return fmt.Errorf("failed to migrate issues table: %w", err)
	}

	// Migrate other tables
	if err := db.AutoMigrate(
		&models.ComponentStat{},
		&models.DailyStat{},
		&models.AlertRule{},
		&models.MutedIssue{},
		&models.Task{},
	); err != nil {
		return fmt.Errorf("failed to migrate other tables: %w", err)
	}

	fmt.Println("✅ Database migration completed successfully")
	return nil
}
