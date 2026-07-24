import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 5432),
  username: configService.get<string>('DB_USERNAME', 'neuraline'),
  password: configService.get<string>('DB_PASSWORD', 'neuraline_secret'),
  database: configService.get<string>('DB_DATABASE', 'neuraline_emr'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: configService.get<boolean>('DB_SYNCHRONIZE', false),
  logging: configService.get<boolean>('DB_LOGGING', true),
  ssl: configService.get<boolean>('DB_SSL', false)
    ? {
        rejectUnauthorized: configService.get<boolean>(
          'DB_SSL_REJECT_UNAUTHORIZED',
          true,
        ),
      }
    : false,
  autoLoadEntities: true,
});

// DataSource for CLI migrations
const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'neuraline',
  password: process.env.DB_PASSWORD || 'neuraline_dev',
  database: process.env.DB_DATABASE || 'neuraline',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: true,
  ssl: process.env.DB_SSL === 'true'
    ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      }
    : false,
};

export default new DataSource(dataSourceOptions);
