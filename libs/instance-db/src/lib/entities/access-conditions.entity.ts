import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('access_conditions')
export class AccessCondition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId!: string;

  @Column()
  field!: string;

  @Column()
  operator!: string;

  @Column()
  value!: string;
}

@Entity('access_condition_groups')
export class AccessConditionGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId!: string;

  @Column()
  logic!: 'AND' | 'OR';
}
