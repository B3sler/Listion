import { MigrationInterface, QueryRunner } from 'typeorm'

export class Init1791981763517 implements MigrationInterface {
  name = 'Init1791981763517'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "name" character varying, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE TABLE "flow" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "name" character varying(60) NOT NULL, "color" character varying(7) NOT NULL DEFAULT '#818cf8', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6c2ad4a3e86394cd9bb7a80a228" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "IDX_ce1f9affcd86880e9160ce36e0" ON "flow"  ("userId") `)
    await queryRunner.query(
      `CREATE TABLE "packet" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "name" character varying(60) NOT NULL, "x" integer NOT NULL DEFAULT '0', "y" integer NOT NULL DEFAULT '0', "flowId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0bef789c4d597bd0b7723f6d878" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_a98244a2c0a3dbc0b3c329e178" ON "packet"  ("flowId") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_a0f4c8dd363cfe053aff68a464" ON "packet"  ("userId") `,
    )
    await queryRunner.query(
      `CREATE TABLE "bit" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "title" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "status" integer NOT NULL DEFAULT '0', "dueDate" TIMESTAMP, "priority" integer, "notes" text, "x" integer, "y" integer, "color" character varying(7), "packetId" uuid, "stepOrder" integer NOT NULL DEFAULT '0', "flowId" uuid, CONSTRAINT "PK_bf625ddd2d7bcc8fb35bdb80f44" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "IDX_45dd80753e1a04ade6764c943a" ON "bit"  ("flowId") `)
    await queryRunner.query(`CREATE INDEX "IDX_1ba511241f12afd8668b5c4a89" ON "bit"  ("packetId") `)
    await queryRunner.query(`CREATE INDEX "IDX_9b38387eb88e65c6d9cd78e76c" ON "bit"  ("userId") `)
    await queryRunner.query(
      `CREATE TABLE "dependency" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "fromType" character varying(6) NOT NULL, "fromId" uuid NOT NULL, "toType" character varying(6) NOT NULL, "toId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d90752dc40dbb4eb7c3bbf53542" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_41a83380f05993876e8481e920" ON "dependency"  ("userId", "fromType", "fromId", "toType", "toId") `,
    )
    await queryRunner.query(
      `ALTER TABLE "flow" ADD CONSTRAINT "FK_ce1f9affcd86880e9160ce36e06" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "packet" ADD CONSTRAINT "FK_a0f4c8dd363cfe053aff68a4643" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "packet" ADD CONSTRAINT "FK_a98244a2c0a3dbc0b3c329e1789" FOREIGN KEY ("flowId") REFERENCES "flow"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "bit" ADD CONSTRAINT "FK_9b38387eb88e65c6d9cd78e76c0" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "bit" ADD CONSTRAINT "FK_1ba511241f12afd8668b5c4a899" FOREIGN KEY ("packetId") REFERENCES "packet"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "bit" ADD CONSTRAINT "FK_45dd80753e1a04ade6764c943ad" FOREIGN KEY ("flowId") REFERENCES "flow"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "dependency" ADD CONSTRAINT "FK_4379c7d49dc40f8da4567c47474" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dependency" DROP CONSTRAINT "FK_4379c7d49dc40f8da4567c47474"`,
    )
    await queryRunner.query(`ALTER TABLE "bit" DROP CONSTRAINT "FK_45dd80753e1a04ade6764c943ad"`)
    await queryRunner.query(`ALTER TABLE "bit" DROP CONSTRAINT "FK_1ba511241f12afd8668b5c4a899"`)
    await queryRunner.query(`ALTER TABLE "bit" DROP CONSTRAINT "FK_9b38387eb88e65c6d9cd78e76c0"`)
    await queryRunner.query(`ALTER TABLE "packet" DROP CONSTRAINT "FK_a98244a2c0a3dbc0b3c329e1789"`)
    await queryRunner.query(`ALTER TABLE "packet" DROP CONSTRAINT "FK_a0f4c8dd363cfe053aff68a4643"`)
    await queryRunner.query(`ALTER TABLE "flow" DROP CONSTRAINT "FK_ce1f9affcd86880e9160ce36e06"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_41a83380f05993876e8481e920"`)
    await queryRunner.query(`DROP TABLE "dependency"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_9b38387eb88e65c6d9cd78e76c"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_1ba511241f12afd8668b5c4a89"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_45dd80753e1a04ade6764c943a"`)
    await queryRunner.query(`DROP TABLE "bit"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_a0f4c8dd363cfe053aff68a464"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_a98244a2c0a3dbc0b3c329e178"`)
    await queryRunner.query(`DROP TABLE "packet"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_ce1f9affcd86880e9160ce36e0"`)
    await queryRunner.query(`DROP TABLE "flow"`)
    await queryRunner.query(`DROP TABLE "users"`)
  }
}
