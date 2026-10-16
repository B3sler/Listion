import { MigrationInterface, QueryRunner } from 'typeorm'

export class BitSheetFields1792135979470 implements MigrationInterface {
  name = 'BitSheetFields1792135979470'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bit" ADD "size" smallint`)
    await queryRunner.query(`ALTER TABLE "bit" ADD "recurrence" character varying(16)`)
    await queryRunner.query(`ALTER TABLE "bit" ADD "completedCount" integer NOT NULL DEFAULT '0'`)
    await queryRunner.query(`ALTER TABLE "bit" ADD "snoozedUntil" date`)
    await queryRunner.query(`ALTER TABLE "bit" ADD "focusSeconds" integer NOT NULL DEFAULT '0'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bit" DROP COLUMN "focusSeconds"`)
    await queryRunner.query(`ALTER TABLE "bit" DROP COLUMN "snoozedUntil"`)
    await queryRunner.query(`ALTER TABLE "bit" DROP COLUMN "completedCount"`)
    await queryRunner.query(`ALTER TABLE "bit" DROP COLUMN "recurrence"`)
    await queryRunner.query(`ALTER TABLE "bit" DROP COLUMN "size"`)
  }
}
