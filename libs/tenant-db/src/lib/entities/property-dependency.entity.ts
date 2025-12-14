import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PropertyDefinition } from './property-definition.entity';

export type DependencyType = 'visibility' | 'required' | 'readonly' | 'value';

export interface DependencyCondition {
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty' | 'contains' | 'starts_with' | 'ends_with';
  value?: unknown;
  values?: unknown[];
}

@Entity('property_dependencies')
@Index(['dependentPropertyId'])
@Index(['dependsOnPropertyId'])
@Index(['dependentPropertyId', 'dependsOnPropertyId'], { unique: true })
export class PropertyDependency {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Property that depends on another */
  @Column({ name: 'dependent_property_id', type: 'uuid' })
  dependentPropertyId!: string;

  @ManyToOne(() => PropertyDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dependent_property_id' })
  dependentProperty?: PropertyDefinition;

  /** Property being depended on */
  @Column({ name: 'depends_on_property_id', type: 'uuid' })
  dependsOnPropertyId!: string;

  @ManyToOne(() => PropertyDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'depends_on_property_id' })
  dependsOnProperty?: PropertyDefinition;

  /** Condition that triggers the dependency */
  @Column({ type: 'jsonb' })
  condition!: DependencyCondition;

  /** What happens when condition is met */
  @Column({ name: 'dependency_type', type: 'varchar', length: 20, default: 'visibility' })
  dependencyType!: DependencyType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
